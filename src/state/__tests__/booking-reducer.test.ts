// Unit Tests: Booking Flow Reducer and Automatic State Reconciliation
import { describe, expect, it } from 'vitest';
import {
  bookingReducer,
  createInitialBookingState,
  stateToBookingInput,
  type BookingState,
} from '../booking-reducer';

describe('Booking Reducer: Initial State & Navigation', () => {
  it('creates an initial state with a default primary adult booker and valid idempotency key', () => {
    const state = createInitialBookingState();
    expect(state.step).toBe('GROUP_AND_PASSES');
    expect(state.attendees.length).toBe(1);
    expect(state.attendees[0].isPrimaryBooker).toBe(true);
    expect(state.attendees[0].age).toBe(28);
    expect(state.attendees[0].ticketAssignment.kind).toBe('DAY_ADULT');
    expect(state.idempotencyKey).toBeTruthy();
    expect(state.promoCode).toBe('');
  });

  it('updates step navigation without regenerating the idempotency key', () => {
    const initial = createInitialBookingState();
    const originalKey = initial.idempotencyKey;

    const next = bookingReducer(initial, { type: 'SET_STEP', step: 'EXTRAS' });
    expect(next.step).toBe('EXTRAS');
    expect(next.idempotencyKey).toBe(originalKey);
  });
});

describe('Booking Reducer: Age Bracket Auto-Reconciliation', () => {
  it('automatically coerces a Child (age 10) to Adult Day Pass when age increases to 14', () => {
    let state = createInitialBookingState();
    // Add child attendee
    state = bookingReducer(state, {
      type: 'ADD_ATTENDEE',
      fullName: 'Aarav',
      age: 10,
    });
    const childId = state.attendees[1].id;
    expect(state.attendees[1].ticketAssignment.kind).toBe('DAY_CHILD');

    // Update age to 14 (Adult bracket)
    const updated = bookingReducer(state, {
      type: 'UPDATE_ATTENDEE_AGE_OR_NAME',
      id: childId,
      age: 14,
    });

    expect(updated.attendees[1].age).toBe(14);
    expect(updated.attendees[1].ticketAssignment.kind).toBe('DAY_ADULT');
  });

  it('automatically coerces a Child to Under-5 Free when age changes to 4, and prunes invalid workshops', () => {
    let state = createInitialBookingState();
    // Add child aged 7
    state = bookingReducer(state, {
      type: 'ADD_ATTENDEE',
      fullName: 'Little Diya',
      age: 7,
    });
    const childId = state.attendees[1].id;

    // Give child attendance on Nov 11
    state = bookingReducer(state, {
      type: 'SET_TICKET_ASSIGNMENT',
      attendeeId: childId,
      assignment: { kind: 'DAY_CHILD', days: ['2026-11-11'] },
    });

    // Book a Garba Workshop for this child on Nov 11
    state = bookingReducer(state, {
      type: 'TOGGLE_GARBA_WORKSHOP',
      attendeeId: childId,
      day: '2026-11-11',
    });
    expect(state.extras.garbaWorkshops.length).toBe(1);

    // Now age changes to 4 (Toddler under 5!)
    const updated = bookingReducer(state, {
      type: 'UPDATE_ATTENDEE_AGE_OR_NAME',
      id: childId,
      age: 4,
    });

    // 1. Ticket must be coerced to UNDER_5_FREE
    expect(updated.attendees[1].ticketAssignment.kind).toBe('UNDER_5_FREE');
    // 2. Workshop must be automatically pruned because toddlers are barred from workshops
    expect(updated.extras.garbaWorkshops.length).toBe(0);
  });

  it('automatically shifts Under-5 toddler to Child Day Pass when age changes to 6', () => {
    let state = createInitialBookingState();
    state = bookingReducer(state, {
      type: 'ADD_ATTENDEE',
      fullName: 'Baby Veer',
      age: 3,
    });
    const toddlerId = state.attendees[1].id;
    expect(state.attendees[1].ticketAssignment.kind).toBe('UNDER_5_FREE');

    const updated = bookingReducer(state, {
      type: 'UPDATE_ATTENDEE_AGE_OR_NAME',
      id: toddlerId,
      age: 6,
    });

    expect(updated.attendees[1].age).toBe(6);
    expect(updated.attendees[1].ticketAssignment.kind).toBe('DAY_CHILD');
  });
});

describe('Booking Reducer: Deselecting Dates & Removing Attendees Auto-Pruning', () => {
  it('prunes garba workshops on a specific date when attendee toggles that date off', () => {
    let state = createInitialBookingState();
    const primaryId = state.attendees[0].id;

    // Select Nov 10 and Nov 11
    state = bookingReducer(state, {
      type: 'TOGGLE_ATTENDEE_DAY',
      attendeeId: primaryId,
      day: '2026-11-11',
    });
    expect((state.attendees[0].ticketAssignment as { days: string[] }).days).toEqual([
      '2026-11-10',
      '2026-11-11',
    ]);

    // Book workshop for Nov 11
    state = bookingReducer(state, {
      type: 'TOGGLE_GARBA_WORKSHOP',
      attendeeId: primaryId,
      day: '2026-11-11',
    });
    expect(state.extras.garbaWorkshops.length).toBe(1);

    // Toggle Nov 11 off
    state = bookingReducer(state, {
      type: 'TOGGLE_ATTENDEE_DAY',
      attendeeId: primaryId,
      day: '2026-11-11',
    });

    // Workshop for Nov 11 must be pruned because attendee is no longer attending Nov 11
    expect(state.extras.garbaWorkshops.length).toBe(0);
  });

  it('prunes workshops and clamps dinner plates when an attendee is removed', () => {
    let state = createInitialBookingState();
    // Add second attendee attending Nov 11
    state = bookingReducer(state, {
      type: 'ADD_ATTENDEE',
      fullName: 'Pooja',
      age: 30,
    });
    const attendee2Id = state.attendees[1].id;

    state = bookingReducer(state, {
      type: 'SET_TICKET_ASSIGNMENT',
      attendeeId: attendee2Id,
      assignment: { kind: 'DAY_ADULT', days: ['2026-11-11'] },
    });

    // Book workshop for attendee 2 on Nov 11
    state = bookingReducer(state, {
      type: 'TOGGLE_GARBA_WORKSHOP',
      attendeeId: attendee2Id,
      day: '2026-11-11',
    });
    expect(state.extras.garbaWorkshops.length).toBe(1);

    // Book 1 dinner plate on Nov 11 (attendee 2 is the ONLY one attending Nov 11)
    state = bookingReducer(state, {
      type: 'SET_DINNER_PLATES_FOR_DAY',
      day: '2026-11-11',
      quantity: 1,
    });
    expect(state.extras.dinnerPlatesByDay['2026-11-11']).toBe(1);

    // Remove attendee 2
    state = bookingReducer(state, {
      type: 'REMOVE_ATTENDEE',
      id: attendee2Id,
    });

    // Workshop must be pruned
    expect(state.extras.garbaWorkshops.length).toBe(0);
    // Dinner plate must be clamped down to 0 because 0 attendees are now attending on Nov 11
    expect(state.extras.dinnerPlatesByDay['2026-11-11']).toBeUndefined();
  });

  it('clamps dinner plates so they never exceed the total attendees present on that date', () => {
    let state = createInitialBookingState(); // 1 attendee on Nov 10

    // Try setting 5 dinner plates on Nov 10
    state = bookingReducer(state, {
      type: 'SET_DINNER_PLATES_FOR_DAY',
      day: '2026-11-10',
      quantity: 5,
    });

    // Must be clamped to 1 (only 1 attendee present on Nov 10)
    expect(state.extras.dinnerPlatesByDay['2026-11-10']).toBe(1);

    // Add a second attendee on Nov 10
    state = bookingReducer(state, {
      type: 'ADD_ATTENDEE',
      age: 26,
    });

    // Now try setting 2 dinner plates
    state = bookingReducer(state, {
      type: 'SET_DINNER_PLATES_FOR_DAY',
      day: '2026-11-10',
      quantity: 2,
    });
    expect(state.extras.dinnerPlatesByDay['2026-11-10']).toBe(2);
  });
});

describe('Booking Reducer: Family Pass Lifecycle', () => {
  it('reverts family pass member to standalone Day Pass if their family pass is deleted', () => {
    let state = createInitialBookingState();
    // Add family pass
    state = bookingReducer(state, {
      type: 'ADD_FAMILY_PASS',
      id: 'fp-special',
      day: '2026-11-12',
    });

    // Assign primary adult to family pass
    state = bookingReducer(state, {
      type: 'SET_TICKET_ASSIGNMENT',
      attendeeId: state.attendees[0].id,
      assignment: {
        kind: 'FAMILY_PASS_MEMBER',
        familyPassId: 'fp-special',
        role: 'ADULT',
      },
    });
    expect(state.attendees[0].ticketAssignment.kind).toBe('FAMILY_PASS_MEMBER');

    // Remove the family pass
    state = bookingReducer(state, {
      type: 'REMOVE_FAMILY_PASS',
      id: 'fp-special',
    });

    // Attendee must be reverted to DAY_ADULT
    expect(state.attendees[0].ticketAssignment.kind).toBe('DAY_ADULT');
  });

  it('adds a family pass bundle with 4 linked members, and removes those members when the pass is removed', () => {
    let state = createInitialBookingState();
    expect(state.attendees.length).toBe(1);

    // Add family pass bundle
    state = bookingReducer(state, {
      type: 'ADD_FAMILY_PASS_BUNDLE',
      id: 'fp-bundle-1',
      day: '2026-11-10',
    });

    expect(state.familyPasses.length).toBe(1);
    expect(state.attendees.length).toBe(5); // Primary + 2 Adults + 2 Children

    const familyMembers = state.attendees.filter(
      (a) =>
        a.ticketAssignment.kind === 'FAMILY_PASS_MEMBER' &&
        a.ticketAssignment.familyPassId === 'fp-bundle-1'
    );
    expect(familyMembers.length).toBe(4);

    // Remove the family pass
    state = bookingReducer(state, {
      type: 'REMOVE_FAMILY_PASS',
      id: 'fp-bundle-1',
    });

    expect(state.familyPasses.length).toBe(0);
    expect(state.attendees.length).toBe(1); // Reverts back to primary booker only!
    expect(state.attendees[0].isPrimaryBooker).toBe(true);
  });
});

describe('Booking Reducer: Idempotency Key Invalidation & Contact Updates', () => {
  it('invalidates idempotency key when cart items or promo code change', () => {
    const initial = createInitialBookingState();
    const key1 = initial.idempotencyKey;

    const afterPromo = bookingReducer(initial, {
      type: 'SET_PROMO_CODE',
      promoCode: 'SEVA10',
    });
    expect(afterPromo.idempotencyKey).not.toBe(key1);
    const key2 = afterPromo.idempotencyKey;

    const afterDandiya = bookingReducer(afterPromo, {
      type: 'SET_DANDIYA_QTY',
      quantity: 2,
    });
    expect(afterDandiya.idempotencyKey).not.toBe(key2);
  });

  it('preserves idempotency key when updating contact details only', () => {
    const initial = createInitialBookingState();
    const key1 = initial.idempotencyKey;

    const afterContact = bookingReducer(initial, {
      type: 'UPDATE_ATTENDEE_CONTACT',
      id: initial.attendees[0].id,
      email: 'booker@test.com',
      phone: '+1-555-9999',
    });

    expect(afterContact.idempotencyKey).toBe(key1);
    expect(afterContact.attendees[0].email).toBe('booker@test.com');
  });

  it('converts booking state to pure domain BookingInput accurately', () => {
    const initial = createInitialBookingState();
    const domainInput = stateToBookingInput(initial);

    expect(domainInput.attendees.length).toBe(1);
    expect(domainInput.familyPasses).toBeUndefined();
    expect(domainInput.promoCode).toBeUndefined();
  });
});
