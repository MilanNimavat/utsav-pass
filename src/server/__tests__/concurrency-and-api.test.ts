// Integration Tests: Concurrency, Atomic Stock Locking, Idempotency, and API Routes
import { beforeEach, describe, expect, it } from 'vitest';
import { GET as getCatalogRoute } from '../../app/api/catalog/route';
import { GET as getBookingByRefRoute } from '../../app/api/bookings/[reference]/route';
import { POST as checkoutRoute } from '../../app/api/bookings/checkout/route';
import { POST as quoteRoute } from '../../app/api/bookings/quote/route';
import { ensureCatalogSeeded, getDb } from '../../db';
import type { BookingInput } from '../../domain/types';
import { createBookingTransaction } from '../booking-service';

function createValidBookingPayload(workshopCount = 2): BookingInput {
  const adult1 = {
    id: 'attendee-primary-1',
    fullName: 'Milan Nimavat',
    age: 32,
    isPrimaryBooker: true,
    email: 'milan@example.com',
    phone: '+1-555-0199',
    ticketAssignment: {
      kind: 'DAY_ADULT' as const,
      days: ['2026-11-11' as const],
    },
  };

  const adult2 = {
    id: 'attendee-adult-2',
    fullName: 'Pooja Nimavat',
    age: 30,
    ticketAssignment: {
      kind: 'DAY_ADULT' as const,
      days: ['2026-11-11' as const],
    },
  };

  const workshops = [];
  if (workshopCount >= 1) {
    workshops.push({ attendeeId: 'attendee-primary-1', day: '2026-11-11' as const });
  }
  if (workshopCount >= 2) {
    workshops.push({ attendeeId: 'attendee-adult-2', day: '2026-11-11' as const });
  }

  return {
    attendees: [adult1, adult2],
    extras: {
      dandiyaPairs: 0,
      dinnerPlatesByDay: {},
      garbaWorkshops: workshops,
    },
  };
}

describe('Database: Catalog Seeding & Initial State', () => {
  beforeEach(async () => {
    const db = getDb();
    if (db.resetDatabaseForTesting) {
      await db.resetDatabaseForTesting();
    }
  });

  it('idempotently seeds catalog with exact specified inventory counts', async () => {
    await ensureCatalogSeeded();
    const db = getDb();
    const inventory = await db.getAllInventory();

    expect(inventory.length).toBe(8);

    const workshop = inventory.find((i) => i.sku === 'GARBA_WORKSHOP');
    expect(workshop?.remaining).toBe(2);
    expect(workshop?.priceCents).toBe(2000);

    const adultAllDay = inventory.find((i) => i.sku === 'ALL_DAY_ADULT');
    expect(adultAllDay?.remaining).toBe(0); // Sold out

    const adultDay = inventory.find((i) => i.sku === 'DAY_ADULT');
    expect(adultDay?.remaining).toBe(380);

    const familyPass = inventory.find((i) => i.sku === 'FAMILY_PASS');
    expect(familyPass?.remaining).toBe(95);
  });
});

describe('Concurrency & Atomic Stock Decrement: Garba Workshop Over-selling Prevention', () => {
  beforeEach(async () => {
    const db = getDb();
    if (db.resetDatabaseForTesting) {
      await db.resetDatabaseForTesting();
    }
  });

  it('guarantees exactly one success (201) and one failure (409) under concurrent checkouts for last 2 spots', async () => {
    // Both requests attempt to claim the last 2 Garba Workshop spots simultaneously
    const payloadA = createValidBookingPayload(2);
    const payloadB = createValidBookingPayload(2);

    const reqA = new Request('http://localhost:3000/api/bookings/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'concurrent-key-user-A',
      },
      body: JSON.stringify(payloadA),
    });

    const reqB = new Request('http://localhost:3000/api/bookings/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'concurrent-key-user-B',
      },
      body: JSON.stringify(payloadB),
    });

    // Execute both concurrently
    const [resA, resB] = await Promise.all([checkoutRoute(reqA), checkoutRoute(reqB)]);

    const statuses = [resA.status, resB.status];
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);

    const successRes = resA.status === 201 ? resA : resB;
    const conflictRes = resA.status === 409 ? resA : resB;

    const successData = await successRes.json();
    expect(successData.ok).toBe(true);
    expect(successData.booking.reference).toMatch(/^SU26-[0-9A-Z]{4}$/);

    const conflictData = await conflictRes.json();
    expect(conflictData.ok).toBe(false);
    expect(conflictData.errorType).toBe('OUT_OF_STOCK');
    expect(conflictData.sku).toBe('GARBA_WORKSHOP');
    expect(conflictData.message).toContain('Garba & Raas Workshop');

    // Confirm that DB inventory remaining for GARBA_WORKSHOP is now strictly 0
    const db = getDb();
    const workshopItem = await db.getInventoryItem('GARBA_WORKSHOP');
    expect(workshopItem?.remaining).toBe(0);

    // Verify a subsequent 3rd checkout also fails immediately with 409
    const reqC = new Request('http://localhost:3000/api/bookings/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'concurrent-key-user-C',
      },
      body: JSON.stringify(createValidBookingPayload(1)),
    });
    const resC = await checkoutRoute(reqC);
    expect(resC.status).toBe(409);
  });
});

describe('Idempotency & Duplicate Request Protection', () => {
  beforeEach(async () => {
    const db = getDb();
    if (db.resetDatabaseForTesting) {
      await db.resetDatabaseForTesting();
    }
  });

  it('returns the same existing booking when called with the same idempotency key without double-decrementing stock', async () => {
    const payload = createValidBookingPayload(1); // 1 workshop spot
    const idempotencyKey = 'idempotent-test-key-12345';

    // First attempt
    const res1 = await createBookingTransaction(payload, idempotencyKey);
    expect(res1.success).toBe(true);
    if (!res1.success) return;

    const originalRef = res1.booking.reference;

    // Remaining workshop spots should now be 1
    const db = getDb();
    const itemAfterFirst = await db.getInventoryItem('GARBA_WORKSHOP');
    expect(itemAfterFirst?.remaining).toBe(1);

    // Second attempt with exact same key
    const res2 = await createBookingTransaction(payload, idempotencyKey);
    expect(res2.success).toBe(true);
    if (!res2.success) return;

    expect(res2.isExisting).toBe(true);
    expect(res2.booking.reference).toBe(originalRef);

    // Remaining workshop spots MUST STILL be 1 (not decremented twice)
    const itemAfterSecond = await db.getInventoryItem('GARBA_WORKSHOP');
    expect(itemAfterSecond?.remaining).toBe(1);
  });
});

describe('API Route Handlers: Catalog, Quote, and Reference Lookup', () => {
  beforeEach(async () => {
    const db = getDb();
    if (db.resetDatabaseForTesting) {
      await db.resetDatabaseForTesting();
    }
  });

  it('GET /api/catalog returns live inventory and no-store cache control headers', async () => {
    const res = await getCatalogRoute();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.festivalDates.length).toBe(5);
    expect(data.inventory.length).toBe(8);
  });

  it('POST /api/bookings/quote returns itemized pricing calculations', async () => {
    const payload = createValidBookingPayload(0);
    const req = new Request('http://localhost:3000/api/bookings/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await quoteRoute(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.quote.grossSubtotalCents).toBe(3000); // 2 adult day passes = $30
    expect(data.quote.totalCents).toBe(3000);
  });

  it('GET /api/bookings/[reference] fetches confirmed booking details and 404 for unknown', async () => {
    // 1. Create a confirmed booking first
    const payload = createValidBookingPayload(0);
    const checkoutReq = new Request('http://localhost:3000/api/bookings/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'ref-lookup-key-999',
      },
      body: JSON.stringify(payload),
    });

    const checkoutRes = await checkoutRoute(checkoutReq);
    expect(checkoutRes.status).toBe(201);
    const checkoutData = await checkoutRes.json();
    const reference = checkoutData.booking.reference;

    // 2. Fetch using reference route
    const getReq = new Request(`http://localhost:3000/api/bookings/${reference}`);
    const getRes = await getBookingByRefRoute(getReq, { params: Promise.resolve({ reference }) });
    expect(getRes.status).toBe(200);

    const retrievedData = await getRes.json();
    expect(retrievedData.ok).toBe(true);
    expect(retrievedData.booking.reference).toBe(reference);
    expect(retrievedData.manifest.length).toBe(2);
    expect(retrievedData.booker.fullName).toBe('Milan Nimavat');

    // 3. Unknown reference returns 404
    const unknownRes = await getBookingByRefRoute(getReq, {
      params: Promise.resolve({ reference: 'SU26-NONEXIST' }),
    });
    expect(unknownRes.status).toBe(404);
  });
});
