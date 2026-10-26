// Server-side Booking Service for Sharad Utsav 2026
import { randomUUID } from 'node:crypto';
import { ensureCatalogSeeded, getDb } from '../db';
import type { BookingRecord, DecrementRequirement } from '../db/types';
import { INITIAL_STOCK, SKU_DETAILS, SKU_PRICES_CENTS } from '../domain/catalog';
import { calculateBookingQuote } from '../domain/pricing';
import {
  FESTIVAL_DATE_LABELS,
  FESTIVAL_DATES,
  type Attendee,
  type BookingInput,
  type BookingQuote,
  type ExtraSku,
  type FestivalDate,
  type InventoryStock,
  type TicketSku,
} from '../domain/types';
import {
  computeRequiredStock,
  getAttendedDays,
  validateBooking,
  type ValidationError,
} from '../domain/validators';

export interface CheckInManifestItem {
  attendeeId: string;
  fullName: string;
  age: number;
  ageBracket: 'UNDER_5' | 'CHILD' | 'ADULT';
  ticketKind: string;
  badgeLabel: string;
  attendedDays: FestivalDate[];
  dinnerDays: FestivalDate[];
  workshops: Array<{ day: FestivalDate }>;
}

export interface BookingSnapshot {
  booking: BookingRecord;
  quote: BookingQuote;
  manifest: CheckInManifestItem[];
  booker: {
    fullName: string;
    email: string;
    phone: string;
    age: number;
  };
}

export type BookingServiceResult =
  | {
      success: true;
      isExisting?: boolean;
      booking: BookingRecord;
      quote: BookingQuote;
      manifest: CheckInManifestItem[];
    }
  | {
      success: false;
      errorType: 'VALIDATION_ERROR';
      errors: ValidationError[];
    }
  | {
      success: false;
      errorType: 'OUT_OF_STOCK';
      sku: TicketSku | ExtraSku;
      skuName: string;
      requested: number;
      remaining: number;
      message: string;
    };

function generateBookingReference(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SU26-${code}`;
}

export function buildCheckInManifest(input: BookingInput): CheckInManifestItem[] {
  const familyPassMap = new Map((input.familyPasses || []).map((p) => [p.id, p]));

  return input.attendees.map((attendee) => {
    let ageBracket: 'UNDER_5' | 'CHILD' | 'ADULT' = 'ADULT';
    if (attendee.age < 5) ageBracket = 'UNDER_5';
    else if (attendee.age <= 11) ageBracket = 'CHILD';

    const attendedDays = getAttendedDays(attendee, familyPassMap);

    let badgeLabel = 'General Admission';
    switch (attendee.ticketAssignment.kind) {
      case 'UNDER_5_FREE':
        badgeLabel = 'Toddler (Free Entry)';
        break;
      case 'DAY_ADULT':
        badgeLabel = `Adult Day Pass (${attendedDays.length} evening${attendedDays.length > 1 ? 's' : ''})`;
        break;
      case 'DAY_CHILD':
        badgeLabel = `Child Day Pass (${attendedDays.length} evening${attendedDays.length > 1 ? 's' : ''})`;
        break;
      case 'ALL_DAY_ADULT':
        badgeLabel = 'Adult All-Day Pass (All 5 Evenings)';
        break;
      case 'ALL_DAY_CHILD':
        badgeLabel = 'Child All-Day Pass (All 5 Evenings)';
        break;
      case 'FAMILY_PASS_MEMBER': {
        const pass = familyPassMap.get(attendee.ticketAssignment.familyPassId);
        const dayLabel = pass ? FESTIVAL_DATE_LABELS[pass.day] : 'Day Pass';
        badgeLabel = `Family Pass Member (${dayLabel} - ${attendee.ticketAssignment.role})`;
        break;
      }
    }

    // Associated workshops
    const workshops = (input.extras?.garbaWorkshops || [])
      .filter((w) => w.attendeeId === attendee.id)
      .map((w) => ({ day: w.day as FestivalDate }));

    // Associated dinners (for simplicity in manifest, if any plates booked on dates attendee attends)
    const dinnerDays = attendedDays.filter((day) => {
      const plates = input.extras?.dinnerPlatesByDay?.[day];
      return typeof plates === 'number' && plates > 0;
    });

    return {
      attendeeId: attendee.id,
      fullName: attendee.fullName,
      age: attendee.age,
      ageBracket,
      ticketKind: attendee.ticketAssignment.kind,
      badgeLabel,
      attendedDays,
      dinnerDays,
      workshops,
    };
  });
}

export async function getLiveStockMap(): Promise<InventoryStock> {
  const db = getDb();
  await ensureCatalogSeeded();
  const rows = await db.getAllInventory();

  const stockMap: InventoryStock = { ...INITIAL_STOCK };
  for (const row of rows) {
    stockMap[row.sku] = row.remaining;
  }
  return stockMap;
}

export async function getLiveCatalog() {
  const db = getDb();
  await ensureCatalogSeeded();
  const rows = await db.getAllInventory();

  const inventory = rows.map((row) => ({
    sku: row.sku,
    name: row.name,
    unitPriceCents: row.priceCents,
    remaining: row.remaining,
    description: SKU_DETAILS[row.sku]?.description ?? '',
    datesAvailable:
      row.sku === 'GARBA_WORKSHOP'
        ? (['2026-11-11', '2026-11-13'] as FestivalDate[])
        : row.sku === 'DINNER_PLATE' || row.sku === 'FAMILY_PASS' || row.sku === 'DAY_ADULT' || row.sku === 'DAY_CHILD'
          ? [...FESTIVAL_DATES]
          : undefined,
  }));

  return {
    festivalDates: FESTIVAL_DATES,
    dateLabels: FESTIVAL_DATE_LABELS,
    inventory,
  };
}

export async function createBookingTransaction(
  payload: BookingInput,
  idempotencyKey: string
): Promise<BookingServiceResult> {
  const db = getDb();
  await ensureCatalogSeeded();

  // 1. Idempotency Check: Return existing booking if key was already processed
  const existingBooking = await db.getBookingByIdempotencyKey(idempotencyKey);
  if (existingBooking) {
    try {
      const parsed = JSON.parse(existingBooking.payloadJson);
      return {
        success: true,
        isExisting: true,
        booking: existingBooking,
        quote: parsed.quote,
        manifest: parsed.manifest,
      };
    } catch {
      // Fallback if payloadJson is legacy
    }
  }

  // 2. Fetch live stock for validation & quote calculation
  const stockMap = await getLiveStockMap();

  // 3. Server-side Domain Validation (structural and business rules)
  const validation = validateBooking(payload);
  if (!validation.valid) {
    return {
      success: false,
      errorType: 'VALIDATION_ERROR',
      errors: validation.errors,
    };
  }

  // 4. Calculate required stock per SKU
  const required = computeRequiredStock(payload);
  const requirements: DecrementRequirement[] = [];

  for (const [skuStr, qty] of Object.entries(required)) {
    const sku = skuStr as TicketSku | ExtraSku;
    if (qty > 0) {
      requirements.push({ sku, quantity: qty });
    }
  }

  // Pre-check stock before transaction
  for (const req of requirements) {
    const available = stockMap[req.sku] ?? 0;
    if (req.quantity > available) {
      const skuName = SKU_DETAILS[req.sku]?.name || req.sku;
      return {
        success: false,
        errorType: 'OUT_OF_STOCK',
        sku: req.sku,
        skuName,
        requested: req.quantity,
        remaining: available,
        message: `Only ${available} spot(s) left for ${skuName}. You requested ${req.quantity}.`,
      };
    }
  }

  // 5. Server-side Authoritative Pricing Calculation
  const quote = calculateBookingQuote(payload, stockMap);

  // 6. Find Primary Booker
  const primaryBooker = payload.attendees.find((a) => a.isPrimaryBooker);
  if (!primaryBooker) {
    return {
      success: false,
      errorType: 'VALIDATION_ERROR',
      errors: [{ field: 'primaryBooker', message: 'No primary booker found' }],
    };
  }

  // 7. Prepare Booking Record
  const bookingId = randomUUID();
  let reference = generateBookingReference();
  // Ensure reference uniqueness
  let refCollision = await db.getBookingByReference(reference);
  while (refCollision) {
    reference = generateBookingReference();
    refCollision = await db.getBookingByReference(reference);
  }

  const manifest = buildCheckInManifest(payload);
  const createdAt = new Date().toISOString();

  const payloadSnapshot = {
    input: payload,
    quote,
    manifest,
    booker: {
      fullName: primaryBooker.fullName,
      email: primaryBooker.email ?? '',
      phone: primaryBooker.phone ?? '',
      age: primaryBooker.age,
    },
  };

  const bookingData = {
    id: bookingId,
    reference,
    idempotencyKey,
    bookerName: primaryBooker.fullName,
    bookerEmail: primaryBooker.email ?? '',
    bookerPhone: primaryBooker.phone ?? '',
    bookerAge: primaryBooker.age,
    promoCode: quote.promoResult?.valid ? quote.promoResult.code : null,
    subtotalCents: quote.grossSubtotalCents,
    discountCents: quote.discountCents,
    totalCents: quote.totalCents,
    paymentStatus: 'PAID' as const,
    payloadJson: JSON.stringify(payloadSnapshot),
    createdAt,
  };

  // 8. Execute Atomic Interactive Transaction
  const txResult = await db.executeBookingTransaction(bookingData, requirements);

  if (!txResult.success) {
    const skuName = SKU_DETAILS[txResult.sku]?.name || txResult.sku;
    return {
      success: false,
      errorType: 'OUT_OF_STOCK',
      sku: txResult.sku,
      skuName,
      requested: txResult.requested,
      remaining: txResult.remaining,
      message: `Only ${txResult.remaining} spot(s) left for ${skuName}. You requested ${txResult.requested}.`,
    };
  }

  return {
    success: true,
    booking: txResult.booking,
    quote,
    manifest,
  };
}

export async function getBookingByReference(
  reference: string
): Promise<BookingSnapshot | null> {
  const db = getDb();
  await ensureCatalogSeeded();

  const booking = await db.getBookingByReference(reference);
  if (!booking) return null;

  try {
    const parsed = JSON.parse(booking.payloadJson);
    return {
      booking,
      quote: parsed.quote,
      manifest: parsed.manifest,
      booker: parsed.booker,
    };
  } catch {
    return null;
  }
}
