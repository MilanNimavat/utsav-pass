// Domain Validators: Pure Zod schemas and validation rules for Sharad Utsav 2026

import { z } from 'zod';
import {
  EXTRA_SKUS,
  FESTIVAL_DATES,
  TICKET_SKUS,
  WORKSHOP_DATES,
  type Attendee,
  type BookingInput,
  type ExtraSku,
  type FamilyPassInstance,
  type FestivalDate,
  type InventoryStock,
  type TicketAssignment,
  type TicketSku,
  type WorkshopDate,
} from './types';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Zod schemas for primitive types
export const festivalDateSchema = z.enum(FESTIVAL_DATES);
export const ticketSkuSchema = z.enum(TICKET_SKUS);
export const extraSkuSchema = z.enum(EXTRA_SKUS);
export const workshopDateSchema = z.enum(WORKSHOP_DATES);

export const ticketAssignmentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('UNDER_5_FREE'),
    days: z.array(festivalDateSchema).min(1, 'Please select at least 1 day of attendance'),
  }),
  z.object({
    kind: z.literal('DAY_ADULT'),
    days: z.array(festivalDateSchema).min(1, 'Please select at least 1 day for Adult Day Pass'),
  }),
  z.object({
    kind: z.literal('DAY_CHILD'),
    days: z.array(festivalDateSchema).min(1, 'Please select at least 1 day for Child Day Pass'),
  }),
  z.object({
    kind: z.literal('ALL_DAY_ADULT'),
  }),
  z.object({
    kind: z.literal('ALL_DAY_CHILD'),
  }),
  z.object({
    kind: z.literal('FAMILY_PASS_MEMBER'),
    familyPassId: z.string().min(1, 'Family Pass ID is required'),
    role: z.enum(['ADULT', 'CHILD']),
  }),
]);

export const attendeeSchema = z.object({
  id: z.string().min(1, 'Attendee ID is required'),
  fullName: z.string().trim().min(1, 'Full name is required'),
  age: z
    .number()
    .int('Age must be an integer')
    .min(0, 'Age cannot be negative')
    .max(120, 'Age must be 120 or younger'),
  isPrimaryBooker: z.boolean().optional(),
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 digits').optional(),
  ticketAssignment: ticketAssignmentSchema,
});

export const familyPassInstanceSchema = z.object({
  id: z.string().min(1, 'Family pass ID is required'),
  day: festivalDateSchema,
});

export const extrasSelectionSchema = z.object({
  dandiyaPairs: z.number().int().min(0, 'Dandiya pairs cannot be negative').max(50, 'Max 50 pairs per order'),
  dinnerPlatesByDay: z.record(festivalDateSchema, z.number().int().min(0)),
  garbaWorkshops: z.array(
    z.object({
      attendeeId: z.string().min(1),
      day: workshopDateSchema,
    })
  ),
});

/**
 * Returns the set of festival dates an attendee is scheduled to attend.
 */
export function getAttendedDays(
  attendee: Attendee,
  familyPassMap: Map<string, FamilyPassInstance>
): FestivalDate[] {
  const assignment = attendee.ticketAssignment;
  switch (assignment.kind) {
    case 'UNDER_5_FREE':
    case 'DAY_ADULT':
    case 'DAY_CHILD':
      return Array.from(new Set(assignment.days));
    case 'ALL_DAY_ADULT':
    case 'ALL_DAY_CHILD':
      return [...FESTIVAL_DATES];
    case 'FAMILY_PASS_MEMBER': {
      const pass = familyPassMap.get(assignment.familyPassId);
      return pass ? [pass.day] : [];
    }
  }
}

/**
 * Calculates total stock required per SKU for a given booking.
 */
export function computeRequiredStock(
  booking: BookingInput
): Record<TicketSku | ExtraSku, number> {
  const required: Record<TicketSku | ExtraSku, number> = {
    DAY_ADULT: 0,
    DAY_CHILD: 0,
    ALL_DAY_ADULT: 0,
    ALL_DAY_CHILD: 0,
    FAMILY_PASS: 0,
    DANDIYA_STICKS: 0,
    DINNER_PLATE: 0,
    GARBA_WORKSHOP: 0,
  };

  // 1. Tickets
  for (const attendee of booking.attendees) {
    const assignment = attendee.ticketAssignment;
    switch (assignment.kind) {
      case 'DAY_ADULT':
        required.DAY_ADULT += assignment.days.length;
        break;
      case 'DAY_CHILD':
        required.DAY_CHILD += assignment.days.length;
        break;
      case 'ALL_DAY_ADULT':
        required.ALL_DAY_ADULT += 1;
        break;
      case 'ALL_DAY_CHILD':
        required.ALL_DAY_CHILD += 1;
        break;
      case 'FAMILY_PASS_MEMBER':
      case 'UNDER_5_FREE':
        // Counted per family pass instance or free
        break;
    }
  }

  // 2. Family Passes
  if (booking.familyPasses) {
    required.FAMILY_PASS += booking.familyPasses.length;
  }

  // 3. Extras
  if (booking.extras) {
    required.DANDIYA_STICKS += booking.extras.dandiyaPairs || 0;

    for (const count of Object.values(booking.extras.dinnerPlatesByDay)) {
      if (typeof count === 'number' && count > 0) {
        required.DINNER_PLATE += count;
      }
    }

    if (booking.extras.garbaWorkshops) {
      required.GARBA_WORKSHOP += booking.extras.garbaWorkshops.length;
    }
  }

  return required;
}

/**
 * Pure domain validation for a complete booking input.
 */
export function validateBooking(
  booking: BookingInput,
  currentStock?: InventoryStock
): ValidationResult {
  const errors: ValidationError[] = [];

  // Basic attendee list check
  if (!booking.attendees || booking.attendees.length === 0) {
    errors.push({
      field: 'attendees',
      message: 'At least one attendee is required',
    });
    return { valid: false, errors };
  }

  // 1. Primary Booker validation
  const primaryBookers = booking.attendees.filter((a) => a.isPrimaryBooker);
  if (primaryBookers.length === 0) {
    errors.push({
      field: 'primaryBooker',
      message: 'A primary booker must be designated',
    });
  } else if (primaryBookers.length > 1) {
    errors.push({
      field: 'primaryBooker',
      message: 'Only one primary booker may be designated per booking',
    });
  } else {
    const booker = primaryBookers[0];
    if (
      typeof booker.age !== 'number' ||
      isNaN(booker.age) ||
      !Number.isInteger(booker.age) ||
      booker.age < 18 ||
      booker.age > 120
    ) {
      errors.push({
        field: 'primaryBooker.age',
        message: 'Primary booker must be an adult aged 18 to 120',
      });
    }

    if (!booker.fullName || booker.fullName.trim().length === 0) {
      errors.push({
        field: 'primaryBooker.fullName',
        message: 'Primary booker full name is required',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!booker.email || !emailRegex.test(booker.email)) {
      errors.push({
        field: 'primaryBooker.email',
        message: 'A valid email address is required for the primary booker',
      });
    }

    if (!booker.phone || booker.phone.trim().length < 7) {
      errors.push({
        field: 'primaryBooker.phone',
        message: 'A valid phone number (at least 7 digits) is required for the primary booker',
      });
    }
  }

  // Map family passes by ID
  const familyPassMap = new Map<string, FamilyPassInstance>();
  if (booking.familyPasses) {
    for (const pass of booking.familyPasses) {
      if (familyPassMap.has(pass.id)) {
        errors.push({
          field: `familyPasses.${pass.id}`,
          message: `Duplicate Family Pass ID: ${pass.id}`,
        });
      }
      familyPassMap.set(pass.id, pass);
    }
  }

  const attendeeMap = new Map<string, Attendee>();

  // 2. Attendee & Age-to-Ticket validation
  for (let i = 0; i < booking.attendees.length; i++) {
    const attendee = booking.attendees[i];
    const prefix = `attendees[${i}]`;

    if (attendeeMap.has(attendee.id)) {
      errors.push({
        field: `${prefix}.id`,
        message: `Duplicate attendee ID: ${attendee.id}`,
      });
    }
    attendeeMap.set(attendee.id, attendee);

    if (!attendee.fullName || attendee.fullName.trim().length === 0) {
      errors.push({
        field: `${prefix}.fullName`,
        message: 'Attendee full name is required',
      });
    }

    if (
      typeof attendee.age !== 'number' ||
      isNaN(attendee.age) ||
      !Number.isInteger(attendee.age) ||
      attendee.age < 0 ||
      attendee.age > 120
    ) {
      errors.push({
        field: `${prefix}.age`,
        message: 'Attendee age must be a valid integer between 0 and 120',
      });
      continue;
    }

    const assignment = attendee.ticketAssignment;

    // Age 0–4 (Under 5)
    if (attendee.age < 5) {
      if (assignment.kind !== 'UNDER_5_FREE') {
        errors.push({
          field: `${prefix}.ticketAssignment`,
          message: 'Children under 5 attend for free and do not need a paid ticket',
        });
      } else if (!assignment.days || assignment.days.length === 0) {
        errors.push({
          field: `${prefix}.ticketAssignment.days`,
          message: 'Please select at least 1 day of attendance for under-5 child',
        });
      }
    }

    // Age 5–11 (Child)
    else if (attendee.age >= 5 && attendee.age <= 11) {
      if (assignment.kind === 'UNDER_5_FREE') {
        errors.push({
          field: `${prefix}.ticketAssignment`,
          message: 'Children aged 5-11 require a child ticket and are not eligible for free toddler entry',
        });
      } else if (assignment.kind === 'DAY_ADULT' || assignment.kind === 'ALL_DAY_ADULT') {
        errors.push({
          field: `${prefix}.ticketAssignment`,
          message: 'Children aged 5-11 must use a Child Day Pass, Child All-Day Pass, or Family Pass, not an Adult Pass',
        });
      } else if (assignment.kind === 'FAMILY_PASS_MEMBER' && assignment.role !== 'CHILD') {
        errors.push({
          field: `${prefix}.ticketAssignment.role`,
          message: 'Attendee aged 5-11 cannot be assigned as an Adult on a Family Pass',
        });
      } else if (
        (assignment.kind === 'DAY_CHILD') &&
        (!assignment.days || assignment.days.length === 0)
      ) {
        errors.push({
          field: `${prefix}.ticketAssignment.days`,
          message: 'Please select at least 1 day for Child Day Pass',
        });
      }
    }

    // Age 12+ (Adult)
    else {
      if (assignment.kind === 'UNDER_5_FREE') {
        errors.push({
          field: `${prefix}.ticketAssignment`,
          message: 'Attendees aged 12 and over require an adult ticket',
        });
      } else if (assignment.kind === 'DAY_CHILD' || assignment.kind === 'ALL_DAY_CHILD') {
        errors.push({
          field: `${prefix}.ticketAssignment`,
          message: 'Attendees aged 12 and over must use an Adult Pass, not a Child Pass',
        });
      } else if (assignment.kind === 'FAMILY_PASS_MEMBER' && assignment.role !== 'ADULT') {
        errors.push({
          field: `${prefix}.ticketAssignment.role`,
          message: 'Attendee aged 12+ cannot be assigned as a Child on a Family Pass',
        });
      } else if (
        (assignment.kind === 'DAY_ADULT') &&
        (!assignment.days || assignment.days.length === 0)
      ) {
        errors.push({
          field: `${prefix}.ticketAssignment.days`,
          message: 'Please select at least 1 day for Adult Day Pass',
        });
      }
    }

    // Check Family Pass existence if referenced
    if (assignment.kind === 'FAMILY_PASS_MEMBER') {
      if (!familyPassMap.has(assignment.familyPassId)) {
        errors.push({
          field: `${prefix}.ticketAssignment.familyPassId`,
          message: `Referenced Family Pass ${assignment.familyPassId} does not exist in family passes`,
        });
      }
    }
  }

  // 3. Family Pass composition validation
  if (booking.familyPasses) {
    for (const pass of booking.familyPasses) {
      const assignedMembers = booking.attendees.filter(
        (a) =>
          a.ticketAssignment.kind === 'FAMILY_PASS_MEMBER' &&
          a.ticketAssignment.familyPassId === pass.id
      );

      const adults = assignedMembers.filter(
        (a) =>
          a.ticketAssignment.kind === 'FAMILY_PASS_MEMBER' &&
          a.ticketAssignment.role === 'ADULT' &&
          a.age >= 12
      );

      const children = assignedMembers.filter(
        (a) =>
          a.ticketAssignment.kind === 'FAMILY_PASS_MEMBER' &&
          a.ticketAssignment.role === 'CHILD' &&
          a.age >= 5 &&
          a.age <= 11
      );

      if (adults.length !== 2 || children.length !== 2) {
        errors.push({
          field: `familyPasses.${pass.id}`,
          message: `Family Pass ${pass.id} must have exactly 2 Adults (12+) and 2 Children (5-11) assigned to it. Found ${adults.length} adult(s) and ${children.length} child(ren).`,
        });
      }
    }
  }

  // 4. Attended Days calculation & Extras validation
  // Compute attendee day attendance map
  const attendeeDaysMap = new Map<string, Set<FestivalDate>>();
  const dayAttendeeCountMap = new Map<FestivalDate, number>();
  for (const date of FESTIVAL_DATES) {
    dayAttendeeCountMap.set(date, 0);
  }

  let hasPaidTicket = false;

  for (const attendee of booking.attendees) {
    const days = getAttendedDays(attendee, familyPassMap);
    attendeeDaysMap.set(attendee.id, new Set(days));

    if (attendee.ticketAssignment.kind !== 'UNDER_5_FREE') {
      hasPaidTicket = true;
    }

    for (const day of days) {
      dayAttendeeCountMap.set(day, (dayAttendeeCountMap.get(day) || 0) + 1);
    }
  }

  if (booking.extras) {
    // Dandiya count
    if (
      typeof booking.extras.dandiyaPairs !== 'number' ||
      isNaN(booking.extras.dandiyaPairs) ||
      !Number.isInteger(booking.extras.dandiyaPairs) ||
      booking.extras.dandiyaPairs < 0 ||
      booking.extras.dandiyaPairs > 50
    ) {
      errors.push({
        field: 'extras.dandiyaPairs',
        message: 'Dandiya pairs must be an integer between 0 and 50',
      });
    }

    // Dinner plates
    let totalPlates = 0;
    for (const [dayStr, count] of Object.entries(booking.extras.dinnerPlatesByDay)) {
      const day = dayStr as FestivalDate;
      if (!FESTIVAL_DATES.includes(day)) {
        errors.push({
          field: `extras.dinnerPlatesByDay.${dayStr}`,
          message: `Invalid festival date for dinner plate: ${dayStr}`,
        });
        continue;
      }

      if (typeof count === 'number' && count > 0) {
        if (!Number.isInteger(count)) {
          errors.push({
            field: `extras.dinnerPlatesByDay.${day}`,
            message: `Dinner plate count for ${day} must be an integer`,
          });
          continue;
        }

        totalPlates += count;
        const attendingOnDay = dayAttendeeCountMap.get(day) || 0;
        if (count > attendingOnDay) {
          errors.push({
            field: `extras.dinnerPlatesByDay.${day}`,
            message: `Dinner plates on ${day} (${count}) cannot exceed group members attending on that date (${attendingOnDay})`,
          });
        }
      }
    }

    if (totalPlates > 0 && !hasPaidTicket) {
      errors.push({
        field: 'extras.dinnerPlatesByDay',
        message: 'Dinner plates can only be purchased in a booking that includes at least 1 paid ticket',
      });
    }

    // Garba workshops
    if (booking.extras.garbaWorkshops) {
      const seenWorkshops = new Set<string>();

      for (let i = 0; i < booking.extras.garbaWorkshops.length; i++) {
        const ws = booking.extras.garbaWorkshops[i];
        const prefix = `extras.garbaWorkshops[${i}]`;

        if (!WORKSHOP_DATES.includes(ws.day)) {
          errors.push({
            field: `${prefix}.day`,
            message: `Garba Workshop is only available on Nov 11 and Nov 13, not ${ws.day}`,
          });
          continue;
        }

        const attendee = attendeeMap.get(ws.attendeeId);
        if (!attendee) {
          errors.push({
            field: `${prefix}.attendeeId`,
            message: `Workshop attendee ${ws.attendeeId} not found in booking`,
          });
          continue;
        }

        if (attendee.age < 5) {
          errors.push({
            field: `${prefix}.attendeeId`,
            message: 'Children under 5 are not eligible for the Garba Workshop (ages 5+ only)',
          });
          continue;
        }

        const attendeeDays = attendeeDaysMap.get(ws.attendeeId);
        if (!attendeeDays || !attendeeDays.has(ws.day as FestivalDate)) {
          errors.push({
            field: `${prefix}.day`,
            message: `${attendee.fullName} is not attending the festival on ${ws.day} and cannot book the workshop for that date`,
          });
        }

        const dedupeKey = `${ws.attendeeId}_${ws.day}`;
        if (seenWorkshops.has(dedupeKey)) {
          errors.push({
            field: `${prefix}`,
            message: `${attendee.fullName} already has a workshop booked for ${ws.day}`,
          });
        }
        seenWorkshops.add(dedupeKey);
      }
    }
  }

  // 5. Stock availability validation
  if (currentStock) {
    const requiredStock = computeRequiredStock(booking);
    for (const [sku, qty] of Object.entries(requiredStock) as [TicketSku | ExtraSku, number][]) {
      const available = currentStock[sku] ?? 0;
      if (qty > available) {
        errors.push({
          field: `stock.${sku}`,
          message: `Insufficient stock for ${sku}: requested ${qty}, but only ${available} available`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
