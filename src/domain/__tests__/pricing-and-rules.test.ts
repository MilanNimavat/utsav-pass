// Unit Tests: Domain pricing, age rules, promos, stock exhaustion, and tricky cases
import { describe, expect, it } from 'vitest';
import { INITIAL_STOCK, SKU_PRICES_CENTS } from '../catalog';
import { calculateBookingQuote } from '../pricing';
import type { Attendee, BookingInput, InventoryStock } from '../types';
import { computeRequiredStock, validateBooking } from '../validators';

// Helper to create a standard valid primary adult booker
function createPrimaryAdult(overrides?: Partial<Attendee>): Attendee {
  return {
    id: 'attendee-primary-1',
    fullName: 'Milan Nimavat',
    age: 32,
    isPrimaryBooker: true,
    email: 'milan@example.com',
    phone: '+1-555-0199',
    ticketAssignment: {
      kind: 'DAY_ADULT',
      days: ['2026-11-10'],
    },
    ...overrides,
  };
}

describe('Domain: Pricing Engine (Exact Integer Cents)', () => {
  it('correctly calculates integer cents for individual Day Passes', () => {
    const adult1 = createPrimaryAdult({
      ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-10', '2026-11-11'] }, // 2 days = 3000¢
    });
    const child1: Attendee = {
      id: 'child-1',
      fullName: 'Aarav Nimavat',
      age: 8,
      ticketAssignment: { kind: 'DAY_CHILD', days: ['2026-11-10'] }, // 1 day = 800¢
    };

    const booking: BookingInput = {
      attendees: [adult1, child1],
    };

    const quote = calculateBookingQuote(booking);
    expect(quote.ticketsSubtotalCents).toBe(3800);
    expect(quote.extrasSubtotalCents).toBe(0);
    expect(quote.grossSubtotalCents).toBe(3800);
    expect(quote.totalCents).toBe(3800);

    const adultLine = quote.lineItems.find((l) => l.sku === 'DAY_ADULT');
    expect(adultLine?.quantity).toBe(2);
    expect(adultLine?.unitCents).toBe(1500);
    expect(adultLine?.subtotalCents).toBe(3000);

    const childLine = quote.lineItems.find((l) => l.sku === 'DAY_CHILD');
    expect(childLine?.quantity).toBe(1);
    expect(childLine?.unitCents).toBe(800);
    expect(childLine?.subtotalCents).toBe(800);
  });

  it('correctly prices All-Day passes ($60 adult, $30 child) and free Under-5 toddlers ($0)', () => {
    const adult1 = createPrimaryAdult({
      ticketAssignment: { kind: 'ALL_DAY_ADULT' }, // 6000¢
    });
    const child1: Attendee = {
      id: 'child-1',
      fullName: 'Diya Patel',
      age: 7,
      ticketAssignment: { kind: 'ALL_DAY_CHILD' }, // 3000¢
    };
    const toddler: Attendee = {
      id: 'toddler-1',
      fullName: 'Baby Veer',
      age: 3,
      ticketAssignment: { kind: 'UNDER_5_FREE', days: ['2026-11-10', '2026-11-11'] }, // 0¢
    };

    const booking: BookingInput = {
      attendees: [adult1, child1, toddler],
    };

    const quote = calculateBookingQuote(booking);
    expect(quote.ticketsSubtotalCents).toBe(9000); // 6000 + 3000 + 0
    expect(quote.totalCents).toBe(9000);

    const toddlerLine = quote.lineItems.find((l) => l.sku === 'UNDER_5_FREE');
    expect(toddlerLine?.subtotalCents).toBe(0);
  });

  it('correctly prices a Family Pass ($40 flat) with 2 Adults and 2 Children', () => {
    const adult1 = createPrimaryAdult({
      ticketAssignment: {
        kind: 'FAMILY_PASS_MEMBER',
        familyPassId: 'fam-1',
        role: 'ADULT',
      },
    });
    const adult2: Attendee = {
      id: 'adult-2',
      fullName: 'Pooja Nimavat',
      age: 30,
      ticketAssignment: {
        kind: 'FAMILY_PASS_MEMBER',
        familyPassId: 'fam-1',
        role: 'ADULT',
      },
    };
    const child1: Attendee = {
      id: 'child-1',
      fullName: 'Child One',
      age: 9,
      ticketAssignment: {
        kind: 'FAMILY_PASS_MEMBER',
        familyPassId: 'fam-1',
        role: 'CHILD',
      },
    };
    const child2: Attendee = {
      id: 'child-2',
      fullName: 'Child Two',
      age: 6,
      ticketAssignment: {
        kind: 'FAMILY_PASS_MEMBER',
        familyPassId: 'fam-1',
        role: 'CHILD',
      },
    };

    const booking: BookingInput = {
      attendees: [adult1, adult2, child1, child2],
      familyPasses: [{ id: 'fam-1', day: '2026-11-14' }],
    };

    const validation = validateBooking(booking);
    expect(validation.valid).toBe(true);

    const quote = calculateBookingQuote(booking);
    expect(quote.ticketsSubtotalCents).toBe(4000); // exactly 4000¢ ($40.00)
    expect(quote.totalCents).toBe(4000);
    const familyLine = quote.lineItems.find((l) => l.sku === 'FAMILY_PASS');
    expect(familyLine?.unitCents).toBe(4000);
    expect(familyLine?.quantity).toBe(1);
  });

  it('prices all extras (Dandiya sticks, dinner plates, workshops) in integer cents', () => {
    const adult = createPrimaryAdult({
      ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-11', '2026-11-12'] },
    });

    const booking: BookingInput = {
      attendees: [adult],
      extras: {
        dandiyaPairs: 2, // 2 * 500 = 1000¢
        dinnerPlatesByDay: {
          '2026-11-11': 1, // 1 * 1200 = 1200¢
        },
        garbaWorkshops: [
          { attendeeId: adult.id, day: '2026-11-11' }, // 1 * 2000 = 2000¢
        ],
      },
    };

    const quote = calculateBookingQuote(booking);
    expect(quote.ticketsSubtotalCents).toBe(3000); // 2 days * 1500
    expect(quote.extrasSubtotalCents).toBe(4200); // 1000 + 1200 + 2000
    expect(quote.grossSubtotalCents).toBe(7200);
    expect(quote.totalCents).toBe(7200);
  });
});

describe('Domain: Age Rules & Booker Validation', () => {
  it('blocks primary booker under 18 years old', () => {
    const youngBooker = createPrimaryAdult({ age: 17 });
    const result = validateBooking({ attendees: [youngBooker] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'primaryBooker.age')).toBe(true);
  });

  it('rejects nonsensical ages: negative, decimals, > 120, and NaN', () => {
    const testAges = [-3, 0.5, 121, NaN];
    for (const badAge of testAges) {
      const booker = createPrimaryAdult({ age: badAge });
      const result = validateBooking({ attendees: [booker] });
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.field.includes('age')),
        `Expected error for bad age: ${badAge}`
      ).toBe(true);
    }
  });

  it('enforces under-5 free rule and blocks paid tickets for toddlers', () => {
    const primary = createPrimaryAdult();
    const toddlerWithPaidTicket: Attendee = {
      id: 'toddler-paid',
      fullName: 'Baby Joy',
      age: 4,
      ticketAssignment: {
        kind: 'DAY_CHILD',
        days: ['2026-11-10'],
      },
    };

    const result = validateBooking({
      attendees: [primary, toddlerWithPaidTicket],
    });

    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.field === 'attendees[1].ticketAssignment');
    expect(err?.message).toContain('Children under 5 attend for free and do not need a paid ticket');
  });

  it('blocks children (5-11) from buying adult tickets and blocks free toddler passes', () => {
    const primary = createPrimaryAdult();
    const childWithAdultTicket: Attendee = {
      id: 'child-1',
      fullName: 'Rohan Patel',
      age: 10,
      ticketAssignment: {
        kind: 'DAY_ADULT',
        days: ['2026-11-10'],
      },
    };

    const result = validateBooking({
      attendees: [primary, childWithAdultTicket],
    });

    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.field === 'attendees[1].ticketAssignment');
    expect(err?.message).toContain('Children aged 5-11 must use a Child Day Pass');
  });

  it('blocks adults (12+) from buying child tickets', () => {
    const adultWithChildTicket = createPrimaryAdult({
      age: 25,
      ticketAssignment: {
        kind: 'DAY_CHILD',
        days: ['2026-11-10'],
      },
    });

    const result = validateBooking({
      attendees: [adultWithChildTicket],
    });

    expect(result.valid).toBe(false);
    const err = result.errors.find((e) => e.field === 'attendees[0].ticketAssignment');
    expect(err?.message).toContain('Attendees aged 12 and over must use an Adult Pass');
  });

  it('rejects invalid Family Pass composition (e.g. 3 Adults and 1 Child)', () => {
    const a1 = createPrimaryAdult({
      ticketAssignment: { kind: 'FAMILY_PASS_MEMBER', familyPassId: 'fp-1', role: 'ADULT' },
    });
    const a2: Attendee = {
      id: 'a2',
      fullName: 'Adult 2',
      age: 30,
      ticketAssignment: { kind: 'FAMILY_PASS_MEMBER', familyPassId: 'fp-1', role: 'ADULT' },
    };
    const a3: Attendee = {
      id: 'a3',
      fullName: 'Adult 3',
      age: 28,
      ticketAssignment: { kind: 'FAMILY_PASS_MEMBER', familyPassId: 'fp-1', role: 'ADULT' },
    };
    const c1: Attendee = {
      id: 'c1',
      fullName: 'Child 1',
      age: 8,
      ticketAssignment: { kind: 'FAMILY_PASS_MEMBER', familyPassId: 'fp-1', role: 'CHILD' },
    };

    const result = validateBooking({
      attendees: [a1, a2, a3, c1],
      familyPasses: [{ id: 'fp-1', day: '2026-11-10' }],
    });

    expect(result.valid).toBe(false);
    const passErr = result.errors.find((e) => e.field === 'familyPasses.fp-1');
    expect(passErr?.message).toContain('must have exactly 2 Adults (12+) and 2 Children (5-11)');
  });
});

describe('Domain: Promo Codes & Discount Rules', () => {
  it('applies SEVA10 (10% off entire gross subtotal with integer rounding)', () => {
    const adult = createPrimaryAdult({
      ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-10'] }, // 1500¢
    });
    const booking: BookingInput = {
      attendees: [adult],
      promoCode: 'SEVA10',
    };

    const quote = calculateBookingQuote(booking);
    expect(quote.promoResult?.valid).toBe(true);
    expect(quote.discountCents).toBe(150); // 10% of 1500 = 150¢
    expect(quote.totalCents).toBe(1350);
  });

  it('applies FLAT20 ($20.00 off) and clamps total to 0 for small orders', () => {
    // 1 child ticket for 1 day = 800¢ + 1 pair of dandiya = 500¢ => Total $13.00 (1300¢)
    const childBooker: Attendee = {
      id: 'adult-primary',
      fullName: 'Anjali Sharma',
      age: 35,
      isPrimaryBooker: true,
      email: 'anjali@example.com',
      phone: '+1-555-0123',
      ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-10'] }, // 1500¢
    };

    // Subtotal 1500¢ with FLAT20 (2000¢ discount) -> total should be 0¢, never negative!
    const bookingSmall: BookingInput = {
      attendees: [childBooker],
      promoCode: 'FLAT20',
    };

    const quote = calculateBookingQuote(bookingSmall);
    expect(quote.promoResult?.valid).toBe(true);
    expect(quote.grossSubtotalCents).toBe(1500);
    expect(quote.promoResult?.rawDiscountCents).toBe(2000);
    expect(quote.discountCents).toBe(1500); // Clamped to gross subtotal
    expect(quote.totalCents).toBe(0); // Floored at $0.00
  });

  it('applies KIDSFREE exclusively to standalone child passes and NOT Family Passes', () => {
    const adult = createPrimaryAdult({
      ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-10'] }, // 1500¢
    });
    const child = {
      id: 'c1',
      fullName: 'Child Aarav',
      age: 7,
      ticketAssignment: { kind: 'DAY_CHILD', days: ['2026-11-10', '2026-11-11'] }, // 2 * 800 = 1600¢
    } as Attendee;

    const booking: BookingInput = {
      attendees: [adult, child],
      promoCode: 'KIDSFREE',
    };

    const quote = calculateBookingQuote(booking);
    expect(quote.grossSubtotalCents).toBe(3100); // 1500 + 1600
    expect(quote.discountCents).toBe(1600); // 100% of child passes
    expect(quote.totalCents).toBe(1500); // Only adult pass is charged
  });

  it('rejects EXPIRED5 with clear explanation message', () => {
    const adult = createPrimaryAdult();
    const quote = calculateBookingQuote({
      attendees: [adult],
      promoCode: 'EXPIRED5',
    });

    expect(quote.promoResult?.valid).toBe(false);
    expect(quote.promoResult?.message).toContain('Promo code EXPIRED5 expired last month');
    expect(quote.discountCents).toBe(0);
    expect(quote.totalCents).toBe(1500);
  });

  it('rejects MAXEDOUT with clear usage limit message', () => {
    const adult = createPrimaryAdult();
    const quote = calculateBookingQuote({
      attendees: [adult],
      promoCode: 'MAXEDOUT',
    });

    expect(quote.promoResult?.valid).toBe(false);
    expect(quote.promoResult?.message).toContain('maximum usage limit');
    expect(quote.discountCents).toBe(0);
  });

  it('rejects unknown promo codes cleanly', () => {
    const adult = createPrimaryAdult();
    const quote = calculateBookingQuote({
      attendees: [adult],
      promoCode: 'SUPERDISCOUNT99',
    });

    expect(quote.promoResult?.valid).toBe(false);
    expect(quote.promoResult?.message).toContain('SUPERDISCOUNT99');
    expect(quote.discountCents).toBe(0);
  });
});

describe('Domain: Stock Exhaustion & Limits', () => {
  it('detects sold out ALL_DAY_ADULT (initial stock 0) and fails validation', () => {
    const adult = createPrimaryAdult({
      ticketAssignment: { kind: 'ALL_DAY_ADULT' },
    });

    const booking: BookingInput = { attendees: [adult] };
    const stock: InventoryStock = { ...INITIAL_STOCK }; // ALL_DAY_ADULT is 0

    const result = validateBooking(booking, stock);
    expect(result.valid).toBe(false);
    const stockErr = result.errors.find((e) => e.field === 'stock.ALL_DAY_ADULT');
    expect(stockErr?.message).toContain('Insufficient stock for ALL_DAY_ADULT: requested 1, but only 0 available');
  });

  it('GARBA_WORKSHOP allows 2 spots and rejects 3 when remaining stock is 2', () => {
    const adult1 = createPrimaryAdult({
      id: 'a1',
      ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-11'] },
    });
    const adult2: Attendee = {
      id: 'a2',
      fullName: 'Adult Two',
      age: 26,
      ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-11'] },
    };
    const adult3: Attendee = {
      id: 'a3',
      fullName: 'Adult Three',
      age: 27,
      ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-11'] },
    };

    const stock: InventoryStock = {
      ...INITIAL_STOCK,
      GARBA_WORKSHOP: 2,
    };

    // Booking with 2 workshops: passes
    const validBooking: BookingInput = {
      attendees: [adult1, adult2],
      extras: {
        dandiyaPairs: 0,
        dinnerPlatesByDay: {},
        garbaWorkshops: [
          { attendeeId: 'a1', day: '2026-11-11' },
          { attendeeId: 'a2', day: '2026-11-11' },
        ],
      },
    };
    expect(validateBooking(validBooking, stock).valid).toBe(true);

    // Booking with 3 workshops: fails
    const invalidBooking: BookingInput = {
      attendees: [adult1, adult2, adult3],
      extras: {
        dandiyaPairs: 0,
        dinnerPlatesByDay: {},
        garbaWorkshops: [
          { attendeeId: 'a1', day: '2026-11-11' },
          { attendeeId: 'a2', day: '2026-11-11' },
          { attendeeId: 'a3', day: '2026-11-11' },
        ],
      },
    };
    const result = validateBooking(invalidBooking, stock);
    expect(result.valid).toBe(false);
    const stockErr = result.errors.find((e) => e.field === 'stock.GARBA_WORKSHOP');
    expect(stockErr?.message).toContain('Insufficient stock for GARBA_WORKSHOP: requested 3, but only 2 available');
  });
});

describe('Domain: Extras Constraints & Date Mismatches', () => {
  it('rejects a Nov 11 Garba Workshop when attendee is only attending on Nov 12', () => {
    const adult = createPrimaryAdult({
      ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-12'] }, // attending Nov 12 only
    });

    const booking: BookingInput = {
      attendees: [adult],
      extras: {
        dandiyaPairs: 0,
        dinnerPlatesByDay: {},
        garbaWorkshops: [
          { attendeeId: adult.id, day: '2026-11-11' }, // Workshop on Nov 11!
        ],
      },
    };

    const result = validateBooking(booking);
    expect(result.valid).toBe(false);
    const wsErr = result.errors.find((e) => e.field === 'extras.garbaWorkshops[0].day');
    expect(wsErr?.message).toContain('is not attending the festival on 2026-11-11');
  });

  it('rejects assigning Garba Workshop to under-5 toddler', () => {
    const adult = createPrimaryAdult({
      ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-11'] },
    });
    const toddler: Attendee = {
      id: 'toddler-1',
      fullName: 'Baby Garba',
      age: 3,
      ticketAssignment: { kind: 'UNDER_5_FREE', days: ['2026-11-11'] },
    };

    const booking: BookingInput = {
      attendees: [adult, toddler],
      extras: {
        dandiyaPairs: 0,
        dinnerPlatesByDay: {},
        garbaWorkshops: [{ attendeeId: toddler.id, day: '2026-11-11' }],
      },
    };

    const result = validateBooking(booking);
    expect(result.valid).toBe(false);
    const wsErr = result.errors.find((e) => e.field === 'extras.garbaWorkshops[0].attendeeId');
    expect(wsErr?.message).toContain('Children under 5 are not eligible for the Garba Workshop');
  });

  it('rejects dinner plates exceeding the number of group members attending on that date', () => {
    const adult = createPrimaryAdult({
      ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-10'] }, // 1 attendee on Nov 10
    });

    const booking: BookingInput = {
      attendees: [adult],
      extras: {
        dandiyaPairs: 0,
        dinnerPlatesByDay: {
          '2026-11-10': 3, // 3 plates requested for 1 person!
        },
        garbaWorkshops: [],
      },
    };

    const result = validateBooking(booking);
    expect(result.valid).toBe(false);
    const plateErr = result.errors.find((e) => e.field === 'extras.dinnerPlatesByDay.2026-11-10');
    expect(plateErr?.message).toContain('cannot exceed group members attending on that date');
  });
});

describe('Domain: Smart UX Advisory Tips', () => {
  it('generates a tip when 4 or 5 Child Day Passes are selected instead of Child All-Day Pass', () => {
    const adult = createPrimaryAdult();
    const child: Attendee = {
      id: 'child-1',
      fullName: 'Diya Patel',
      age: 8,
      ticketAssignment: {
        kind: 'DAY_CHILD',
        days: ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'], // 4 days = $32 vs $30
      },
    };

    const booking: BookingInput = {
      attendees: [adult, child],
    };

    const quote = calculateBookingQuote(booking, INITIAL_STOCK);
    const tip = quote.smartTips.find((t) => t.id.startsWith('child_pass_optimization'));
    expect(tip).toBeDefined();
    expect(tip?.message).toContain('covers all 5 days and saves you $2.00');
    expect(tip?.potentialSavingsCents).toBe(200);
  });

  it('generates a tip when KIDSFREE is applied with Family Pass advising individual passes save $10', () => {
    const adult1 = createPrimaryAdult({
      ticketAssignment: { kind: 'FAMILY_PASS_MEMBER', familyPassId: 'fp-1', role: 'ADULT' },
    });
    const adult2: Attendee = {
      id: 'a2',
      fullName: 'Adult 2',
      age: 30,
      ticketAssignment: { kind: 'FAMILY_PASS_MEMBER', familyPassId: 'fp-1', role: 'ADULT' },
    };
    const c1: Attendee = {
      id: 'c1',
      fullName: 'Child 1',
      age: 8,
      ticketAssignment: { kind: 'FAMILY_PASS_MEMBER', familyPassId: 'fp-1', role: 'CHILD' },
    };
    const c2: Attendee = {
      id: 'c2',
      fullName: 'Child 2',
      age: 9,
      ticketAssignment: { kind: 'FAMILY_PASS_MEMBER', familyPassId: 'fp-1', role: 'CHILD' },
    };

    const booking: BookingInput = {
      attendees: [adult1, adult2, c1, c2],
      familyPasses: [{ id: 'fp-1', day: '2026-11-10' }],
      promoCode: 'KIDSFREE',
    };

    const quote = calculateBookingQuote(booking);
    const tip = quote.smartTips.find((t) => t.id === 'family_pass_kidsfree_optimization');
    expect(tip).toBeDefined();
    expect(tip?.message).toContain('saving you $10.00 compared to each $40.00 Family Pass');
    expect(tip?.potentialSavingsCents).toBe(1000);
  });
});
