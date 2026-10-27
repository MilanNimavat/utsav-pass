// Strongly-Typed Booking Flow State Machine for Sharad Utsav 2026
import {
  FESTIVAL_DATES,
  type Attendee,
  type BookingInput,
  type BookingQuote,
  type ExtrasSelection,
  type FamilyPassInstance,
  type FestivalDate,
  type GarbaWorkshopSelection,
  type TicketAssignment,
  type WorkshopDate,
} from '../domain/types';
import { getAttendedDays } from '../domain/validators';

export type FlowStep =
  | 'GROUP_AND_PASSES'
  | 'EXTRAS'
  | 'ATTENDEE_DETAILS'
  | 'PAYMENT'
  | 'CONFIRMED';

export interface BookingState {
  step: FlowStep;
  attendees: Attendee[];
  familyPasses: FamilyPassInstance[];
  extras: ExtrasSelection;
  promoCode: string;
  serverQuote: BookingQuote | null;
  idempotencyKey: string;
  confirmedReference: string | null;
}

export type BookingAction =
  | { type: 'SET_STEP'; step: FlowStep }
  | {
      type: 'ADD_ATTENDEE';
      fullName?: string;
      age?: number;
      isPrimaryBooker?: boolean;
      ticketAssignment?: TicketAssignment;
    }
  | { type: 'REMOVE_ATTENDEE'; id: string }
  | {
      type: 'UPDATE_ATTENDEE_AGE_OR_NAME';
      id: string;
      fullName?: string;
      age?: number;
    }
  | {
      type: 'UPDATE_ATTENDEE_CONTACT';
      id: string;
      email?: string;
      phone?: string;
    }
  | {
      type: 'SET_TICKET_ASSIGNMENT';
      attendeeId: string;
      assignment: TicketAssignment;
    }
  | {
      type: 'TOGGLE_ATTENDEE_DAY';
      attendeeId: string;
      day: FestivalDate;
    }
  | {
      type: 'ADD_FAMILY_PASS';
      id?: string;
      day: FestivalDate;
    }
  | {
      type: 'ADD_FAMILY_PASS_BUNDLE';
      id?: string;
      day: FestivalDate;
    }
  | { type: 'REMOVE_FAMILY_PASS'; id: string }
  | {
      type: 'SET_FAMILY_PASS_DAY';
      id: string;
      day: FestivalDate;
    }
  | { type: 'SET_DANDIYA_QTY'; quantity: number }
  | {
      type: 'SET_DINNER_PLATES_FOR_DAY';
      day: FestivalDate;
      quantity: number;
    }
  | {
      type: 'TOGGLE_GARBA_WORKSHOP';
      attendeeId: string;
      day: WorkshopDate;
    }
  | { type: 'SET_PROMO_CODE'; promoCode: string }
  | { type: 'SYNC_SERVER_QUOTE'; quote: BookingQuote | null }
  | { type: 'RESET_IDEMPOTENCY_KEY'; key?: string }
  | { type: 'SET_CONFIRMED'; reference: string };

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function extractDays(assignment: TicketAssignment): FestivalDate[] {
  if (
    assignment.kind === 'DAY_ADULT' ||
    assignment.kind === 'DAY_CHILD' ||
    assignment.kind === 'UNDER_5_FREE'
  ) {
    return assignment.days.length > 0 ? assignment.days : ['2026-11-10'];
  }
  return ['2026-11-10'];
}

export function getDefaultAssignmentForAge(
  age: number,
  fallbackDays: FestivalDate[] = ['2026-11-10']
): TicketAssignment {
  const safeDays: FestivalDate[] = fallbackDays.length > 0 ? fallbackDays : ['2026-11-10'];
  if (age < 5) {
    return { kind: 'UNDER_5_FREE', days: safeDays };
  }
  if (age <= 11) {
    return { kind: 'DAY_CHILD', days: safeDays };
  }
  return { kind: 'DAY_ADULT', days: safeDays };
}

/**
 * Reconciles the booking state to guarantee domain invariant integrity:
 * 1. Checks each attendee's ticket against their age; coerces to safe default if age bracket shifted.
 * 2. Unassigns attendees referencing deleted Family Passes.
 * 3. Prunes Garba Workshops if attendee removed, is under 5, or no longer attending on that workshop date.
 * 4. Clamps Dinner Plates per day so they never exceed the count of attendees present on that date.
 */
export function reconcileState(state: BookingState): BookingState {
  const familyPassMap = new Map(state.familyPasses.map((p) => [p.id, p]));

  // 1. Reconcile attendees and ticket assignments
  const reconciledAttendees: Attendee[] = state.attendees.map((attendee) => {
    const age = attendee.age;
    const assignment = attendee.ticketAssignment;
    const existingDays = extractDays(assignment);

    // A. Under-5 Toddler
    if (age < 5) {
      if (assignment.kind !== 'UNDER_5_FREE') {
        return {
          ...attendee,
          ticketAssignment: { kind: 'UNDER_5_FREE', days: existingDays },
        };
      }
      return attendee;
    }

    // B. Child (5-11)
    if (age >= 5 && age <= 11) {
      if (assignment.kind === 'UNDER_5_FREE' || assignment.kind === 'DAY_ADULT') {
        return {
          ...attendee,
          ticketAssignment: { kind: 'DAY_CHILD', days: existingDays },
        };
      }
      if (assignment.kind === 'ALL_DAY_ADULT') {
        return {
          ...attendee,
          ticketAssignment: { kind: 'ALL_DAY_CHILD' },
        };
      }
      if (assignment.kind === 'FAMILY_PASS_MEMBER') {
        if (!familyPassMap.has(assignment.familyPassId)) {
          return {
            ...attendee,
            ticketAssignment: { kind: 'DAY_CHILD', days: ['2026-11-10'] },
          };
        }
        if (assignment.role !== 'CHILD') {
          return {
            ...attendee,
            ticketAssignment: { ...assignment, role: 'CHILD' },
          };
        }
      }
      return attendee;
    }

    // C. Adult (12+)
    if (age >= 12) {
      if (assignment.kind === 'UNDER_5_FREE' || assignment.kind === 'DAY_CHILD') {
        return {
          ...attendee,
          ticketAssignment: { kind: 'DAY_ADULT', days: existingDays },
        };
      }
      if (assignment.kind === 'ALL_DAY_CHILD') {
        // Adult All-day is sold out, so fallback to Day Adult with all 5 days
        return {
          ...attendee,
          ticketAssignment: { kind: 'DAY_ADULT', days: [...FESTIVAL_DATES] },
        };
      }
      if (assignment.kind === 'FAMILY_PASS_MEMBER') {
        if (!familyPassMap.has(assignment.familyPassId)) {
          return {
            ...attendee,
            ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-10'] },
          };
        }
        if (assignment.role !== 'ADULT') {
          return {
            ...attendee,
            ticketAssignment: { ...assignment, role: 'ADULT' },
          };
        }
      }
      return attendee;
    }

    return attendee;
  });

  // Calculate attendee counts and attended dates per person
  const attendeeMap = new Map(reconciledAttendees.map((a) => [a.id, a]));
  const attendeeDaysMap = new Map<string, FestivalDate[]>();
  const attendeeCountByDay: Record<FestivalDate, number> = {
    '2026-11-10': 0,
    '2026-11-11': 0,
    '2026-11-12': 0,
    '2026-11-13': 0,
    '2026-11-14': 0,
  };

  for (const attendee of reconciledAttendees) {
    const days = getAttendedDays(attendee, familyPassMap);
    attendeeDaysMap.set(attendee.id, days);
    for (const d of days) {
      attendeeCountByDay[d] = (attendeeCountByDay[d] || 0) + 1;
    }
  }

  // 2. Prune Garba Workshops:
  // Must exist in attendees, be age >= 5, and be attending festival on that workshop date
  const reconciledWorkshops: GarbaWorkshopSelection[] = (
    state.extras.garbaWorkshops || []
  ).filter((ws) => {
    const attendee = attendeeMap.get(ws.attendeeId);
    if (!attendee) return false;
    if (attendee.age < 5) return false;
    const days = attendeeDaysMap.get(ws.attendeeId) || [];
    return days.includes(ws.day as FestivalDate);
  });

  // 3. Clamp Dinner Plates:
  // Cannot exceed attendees attending on that date
  const reconciledDinnerPlates: Partial<Record<FestivalDate, number>> = {};
  for (const [dayStr, count] of Object.entries(state.extras.dinnerPlatesByDay || {})) {
    const day = dayStr as FestivalDate;
    if (typeof count === 'number' && count > 0) {
      const maxAllowed = attendeeCountByDay[day] || 0;
      const clamped = Math.min(count, maxAllowed);
      if (clamped > 0) {
        reconciledDinnerPlates[day] = clamped;
      }
    }
  }

  return {
    ...state,
    attendees: reconciledAttendees,
    extras: {
      ...state.extras,
      garbaWorkshops: reconciledWorkshops,
      dinnerPlatesByDay: reconciledDinnerPlates,
    },
  };
}

export function createInitialBookingState(): BookingState {
  const primaryId = 'att_primary_1';
  return {
    step: 'GROUP_AND_PASSES',
    attendees: [
      {
        id: primaryId,
        fullName: '',
        age: 28,
        isPrimaryBooker: true,
        email: '',
        phone: '',
        ticketAssignment: {
          kind: 'DAY_ADULT',
          days: ['2026-11-10'],
        },
      },
    ],
    familyPasses: [],
    extras: {
      dandiyaPairs: 0,
      dinnerPlatesByDay: {},
      garbaWorkshops: [],
    },
    promoCode: '',
    serverQuote: null,
    idempotencyKey: generateIdempotencyKey(),
    confirmedReference: null,
  };
}

/**
 * Main Booking State Machine Reducer with Automatic State Reconciliation
 */
export function bookingReducer(
  state: BookingState,
  action: BookingAction
): BookingState {
  switch (action.type) {
    case 'SET_STEP': {
      return {
        ...state,
        step: action.step,
      };
    }

    case 'ADD_ATTENDEE': {
      const newId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const age = action.age ?? 25;
      const newAttendee: Attendee = {
        id: newId,
        fullName: action.fullName ?? '',
        age,
        isPrimaryBooker: action.isPrimaryBooker ?? false,
        ticketAssignment: action.ticketAssignment ?? getDefaultAssignmentForAge(age),
      };

      const nextState: BookingState = {
        ...state,
        attendees: [...state.attendees, newAttendee],
        idempotencyKey: generateIdempotencyKey(),
      };
      return reconcileState(nextState);
    }

    case 'REMOVE_ATTENDEE': {
      // Don't remove if only 1 attendee remaining
      if (state.attendees.length <= 1) return state;

      const remainingAttendees = state.attendees.filter((a) => a.id !== action.id);
      // Ensure there is always a designated primary booker
      if (!remainingAttendees.some((a) => a.isPrimaryBooker)) {
        remainingAttendees[0] = { ...remainingAttendees[0], isPrimaryBooker: true };
      }

      const nextState: BookingState = {
        ...state,
        attendees: remainingAttendees,
        idempotencyKey: generateIdempotencyKey(),
      };
      return reconcileState(nextState);
    }

    case 'UPDATE_ATTENDEE_AGE_OR_NAME': {
      const nextAttendees = state.attendees.map((a) => {
        if (a.id !== action.id) return a;
        return {
          ...a,
          fullName: action.fullName !== undefined ? action.fullName : a.fullName,
          age: action.age !== undefined ? action.age : a.age,
        };
      });

      const nextState: BookingState = {
        ...state,
        attendees: nextAttendees,
        idempotencyKey: generateIdempotencyKey(),
      };
      return reconcileState(nextState);
    }

    case 'UPDATE_ATTENDEE_CONTACT': {
      // Contact updates do not change cart pricing or stock; preserve idempotencyKey
      const nextAttendees = state.attendees.map((a) => {
        if (a.id !== action.id) return a;
        return {
          ...a,
          email: action.email !== undefined ? action.email : a.email,
          phone: action.phone !== undefined ? action.phone : a.phone,
        };
      });

      return {
        ...state,
        attendees: nextAttendees,
      };
    }

    case 'SET_TICKET_ASSIGNMENT': {
      const nextAttendees = state.attendees.map((a) => {
        if (a.id !== action.attendeeId) return a;
        return {
          ...a,
          ticketAssignment: action.assignment,
        };
      });

      const nextState: BookingState = {
        ...state,
        attendees: nextAttendees,
        idempotencyKey: generateIdempotencyKey(),
      };
      return reconcileState(nextState);
    }

    case 'TOGGLE_ATTENDEE_DAY': {
      const nextAttendees = state.attendees.map((a) => {
        if (a.id !== action.attendeeId) return a;
        const assignment = a.ticketAssignment;

        if (
          assignment.kind !== 'DAY_ADULT' &&
          assignment.kind !== 'DAY_CHILD' &&
          assignment.kind !== 'UNDER_5_FREE'
        ) {
          return a;
        }

        const currentDays = assignment.days;
        let newDays: FestivalDate[];

        if (currentDays.includes(action.day)) {
          // If already present, remove only if more than 1 day selected
          newDays = currentDays.length > 1 ? currentDays.filter((d) => d !== action.day) : currentDays;
        } else {
          newDays = [...currentDays, action.day];
        }

        return {
          ...a,
          ticketAssignment: {
            ...assignment,
            days: newDays,
          },
        };
      });

      const nextState: BookingState = {
        ...state,
        attendees: nextAttendees,
        idempotencyKey: generateIdempotencyKey(),
      };
      return reconcileState(nextState);
    }

    case 'ADD_FAMILY_PASS': {
      const passId = action.id || `fp_${Date.now()}`;
      const newPass: FamilyPassInstance = {
        id: passId,
        day: action.day,
      };

      const nextState: BookingState = {
        ...state,
        familyPasses: [...state.familyPasses, newPass],
        idempotencyKey: generateIdempotencyKey(),
      };
      return reconcileState(nextState);
    }

    case 'ADD_FAMILY_PASS_BUNDLE': {
      const passId = action.id || `fp_${Date.now()}`;
      const newPass: FamilyPassInstance = {
        id: passId,
        day: action.day,
      };

      const adult1: Attendee = {
        id: `att_${Date.now()}_a1_${Math.random().toString(36).substring(2, 5)}`,
        fullName: 'Adult 1',
        age: 35,
        ticketAssignment: { kind: 'FAMILY_PASS_MEMBER', familyPassId: passId, role: 'ADULT' },
      };
      const adult2: Attendee = {
        id: `att_${Date.now()}_a2_${Math.random().toString(36).substring(2, 5)}`,
        fullName: 'Adult 2',
        age: 32,
        ticketAssignment: { kind: 'FAMILY_PASS_MEMBER', familyPassId: passId, role: 'ADULT' },
      };
      const child1: Attendee = {
        id: `att_${Date.now()}_c1_${Math.random().toString(36).substring(2, 5)}`,
        fullName: 'Child 1',
        age: 8,
        ticketAssignment: { kind: 'FAMILY_PASS_MEMBER', familyPassId: passId, role: 'CHILD' },
      };
      const child2: Attendee = {
        id: `att_${Date.now()}_c2_${Math.random().toString(36).substring(2, 5)}`,
        fullName: 'Child 2',
        age: 6,
        ticketAssignment: { kind: 'FAMILY_PASS_MEMBER', familyPassId: passId, role: 'CHILD' },
      };

      const nextState: BookingState = {
        ...state,
        familyPasses: [...state.familyPasses, newPass],
        attendees: [...state.attendees, adult1, adult2, child1, child2],
        idempotencyKey: generateIdempotencyKey(),
      };
      return reconcileState(nextState);
    }

    case 'REMOVE_FAMILY_PASS': {
      // Automatically remove any non-primary attendees that were assigned to this family pass
      const remainingAttendees = state.attendees.filter(
        (a) =>
          a.isPrimaryBooker ||
          !(
            a.ticketAssignment.kind === 'FAMILY_PASS_MEMBER' &&
            a.ticketAssignment.familyPassId === action.id
          )
      );

      const nextState: BookingState = {
        ...state,
        attendees: remainingAttendees,
        familyPasses: state.familyPasses.filter((p) => p.id !== action.id),
        idempotencyKey: generateIdempotencyKey(),
      };
      return reconcileState(nextState);
    }

    case 'SET_FAMILY_PASS_DAY': {
      const nextPasses = state.familyPasses.map((p) =>
        p.id === action.id ? { ...p, day: action.day } : p
      );
      const nextState: BookingState = {
        ...state,
        familyPasses: nextPasses,
        idempotencyKey: generateIdempotencyKey(),
      };
      return reconcileState(nextState);
    }

    case 'SET_DANDIYA_QTY': {
      const clamped = Math.max(0, Math.min(50, Math.round(action.quantity || 0)));
      return {
        ...state,
        extras: {
          ...state.extras,
          dandiyaPairs: clamped,
        },
        idempotencyKey: generateIdempotencyKey(),
      };
    }

    case 'SET_DINNER_PLATES_FOR_DAY': {
      const nextPlates = { ...state.extras.dinnerPlatesByDay };
      if (action.quantity <= 0) {
        delete nextPlates[action.day];
      } else {
        nextPlates[action.day] = action.quantity;
      }

      const nextState: BookingState = {
        ...state,
        extras: {
          ...state.extras,
          dinnerPlatesByDay: nextPlates,
        },
        idempotencyKey: generateIdempotencyKey(),
      };
      return reconcileState(nextState);
    }

    case 'TOGGLE_GARBA_WORKSHOP': {
      const exists = state.extras.garbaWorkshops.some(
        (w) => w.attendeeId === action.attendeeId && w.day === action.day
      );

      let nextWorkshops: GarbaWorkshopSelection[];
      if (exists) {
        nextWorkshops = state.extras.garbaWorkshops.filter(
          (w) => !(w.attendeeId === action.attendeeId && w.day === action.day)
        );
      } else {
        nextWorkshops = [
          ...state.extras.garbaWorkshops,
          { attendeeId: action.attendeeId, day: action.day },
        ];
      }

      const nextState: BookingState = {
        ...state,
        extras: {
          ...state.extras,
          garbaWorkshops: nextWorkshops,
        },
        idempotencyKey: generateIdempotencyKey(),
      };
      return reconcileState(nextState);
    }

    case 'SET_PROMO_CODE': {
      return {
        ...state,
        promoCode: action.promoCode.trim().toUpperCase(),
        idempotencyKey: generateIdempotencyKey(),
      };
    }

    case 'SYNC_SERVER_QUOTE': {
      return {
        ...state,
        serverQuote: action.quote,
      };
    }

    case 'RESET_IDEMPOTENCY_KEY': {
      return {
        ...state,
        idempotencyKey: action.key || generateIdempotencyKey(),
      };
    }

    case 'SET_CONFIRMED': {
      return {
        ...state,
        step: 'CONFIRMED',
        confirmedReference: action.reference,
      };
    }

    default:
      return state;
  }
}

/**
 * Converts internal BookingState into pure domain BookingInput for quote / checkout API requests.
 */
export function stateToBookingInput(state: BookingState): BookingInput {
  return {
    attendees: state.attendees,
    familyPasses: state.familyPasses.length > 0 ? state.familyPasses : undefined,
    extras: state.extras,
    promoCode: state.promoCode.length > 0 ? state.promoCode : undefined,
  };
}
