// Domain Pricing: Pure calculation engine for quotes, line items, promos, and smart tips

import { SKU_PRICES_CENTS } from './catalog';
import {
  FESTIVAL_DATE_LABELS,
  type BookingInput,
  type BookingQuote,
  type InventoryStock,
  type LineItem,
  type PromoResult,
  type SmartTip,
} from './types';

/**
 * Pure calculation engine to produce a complete BookingQuote.
 */
export function calculateBookingQuote(
  input: BookingInput,
  currentStock?: InventoryStock
): BookingQuote {
  const lineItems: LineItem[] = [];

  // 1. Process Attendee Tickets
  for (const attendee of input.attendees) {
    const assignment = attendee.ticketAssignment;

    switch (assignment.kind) {
      case 'UNDER_5_FREE':
        lineItems.push({
          id: `ticket_${attendee.id}_under5`,
          label: `${attendee.fullName} - Toddler Entry (Ages 0-4)`,
          sku: 'UNDER_5_FREE',
          quantity: 1,
          unitCents: 0,
          subtotalCents: 0,
          attendeeName: attendee.fullName,
        });
        break;

      case 'DAY_ADULT': {
        const qty = assignment.days.length;
        const unitCents = SKU_PRICES_CENTS.DAY_ADULT;
        const subtotalCents = unitCents * qty;
        lineItems.push({
          id: `ticket_${attendee.id}_day_adult`,
          label: `${attendee.fullName} - Adult Day Pass (${qty} day${qty > 1 ? 's' : ''})`,
          sku: 'DAY_ADULT',
          quantity: qty,
          unitCents,
          subtotalCents,
          attendeeName: attendee.fullName,
        });
        break;
      }

      case 'DAY_CHILD': {
        const qty = assignment.days.length;
        const unitCents = SKU_PRICES_CENTS.DAY_CHILD;
        const subtotalCents = unitCents * qty;
        lineItems.push({
          id: `ticket_${attendee.id}_day_child`,
          label: `${attendee.fullName} - Child Day Pass (${qty} day${qty > 1 ? 's' : ''})`,
          sku: 'DAY_CHILD',
          quantity: qty,
          unitCents,
          subtotalCents,
          attendeeName: attendee.fullName,
        });
        break;
      }

      case 'ALL_DAY_ADULT': {
        const unitCents = SKU_PRICES_CENTS.ALL_DAY_ADULT;
        lineItems.push({
          id: `ticket_${attendee.id}_all_day_adult`,
          label: `${attendee.fullName} - Adult All-Day Pass (5 Days)`,
          sku: 'ALL_DAY_ADULT',
          quantity: 1,
          unitCents,
          subtotalCents: unitCents,
          attendeeName: attendee.fullName,
        });
        break;
      }

      case 'ALL_DAY_CHILD': {
        const unitCents = SKU_PRICES_CENTS.ALL_DAY_CHILD;
        lineItems.push({
          id: `ticket_${attendee.id}_all_day_child`,
          label: `${attendee.fullName} - Child All-Day Pass (5 Days)`,
          sku: 'ALL_DAY_CHILD',
          quantity: 1,
          unitCents,
          subtotalCents: unitCents,
          attendeeName: attendee.fullName,
        });
        break;
      }

      case 'FAMILY_PASS_MEMBER':
        // Priced as part of FamilyPassInstance below
        break;
    }
  }

  // 2. Process Family Passes
  if (input.familyPasses) {
    for (const pass of input.familyPasses) {
      const dateLabel = FESTIVAL_DATE_LABELS[pass.day] || pass.day;
      const unitCents = SKU_PRICES_CENTS.FAMILY_PASS;
      lineItems.push({
        id: `family_pass_${pass.id}`,
        label: `Family Pass (${dateLabel} - 2 Adults + 2 Children)`,
        sku: 'FAMILY_PASS',
        quantity: 1,
        unitCents,
        subtotalCents: unitCents,
        date: pass.day,
      });
    }
  }

  const ticketsSubtotalCents = lineItems.reduce((sum, item) => sum + item.subtotalCents, 0);

  // 3. Process Extras
  const extrasLineItems: LineItem[] = [];

  if (input.extras) {
    // Dandiya pairs
    if (input.extras.dandiyaPairs > 0) {
      const qty = input.extras.dandiyaPairs;
      const unitCents = SKU_PRICES_CENTS.DANDIYA_STICKS;
      extrasLineItems.push({
        id: 'extra_dandiya',
        label: `Dandiya Sticks (${qty} pair${qty > 1 ? 's' : ''})`,
        sku: 'DANDIYA_STICKS',
        quantity: qty,
        unitCents,
        subtotalCents: unitCents * qty,
      });
    }

    // Dinner plates by day
    for (const [dayStr, count] of Object.entries(input.extras.dinnerPlatesByDay)) {
      if (typeof count === 'number' && count > 0) {
        const day = dayStr as keyof typeof FESTIVAL_DATE_LABELS;
        const dateLabel = FESTIVAL_DATE_LABELS[day] || dayStr;
        const unitCents = SKU_PRICES_CENTS.DINNER_PLATE;
        extrasLineItems.push({
          id: `extra_dinner_${dayStr}`,
          label: `Dinner Plate - ${dateLabel}`,
          sku: 'DINNER_PLATE',
          quantity: count,
          unitCents,
          subtotalCents: unitCents * count,
          date: day,
        });
      }
    }

    // Garba workshops
    if (input.extras.garbaWorkshops) {
      const attendeeMap = new Map(input.attendees.map((a) => [a.id, a]));
      for (const ws of input.extras.garbaWorkshops) {
        const attendee = attendeeMap.get(ws.attendeeId);
        const name = attendee ? attendee.fullName : 'Attendee';
        const dateLabel = FESTIVAL_DATE_LABELS[ws.day] || ws.day;
        const unitCents = SKU_PRICES_CENTS.GARBA_WORKSHOP;
        extrasLineItems.push({
          id: `extra_workshop_${ws.attendeeId}_${ws.day}`,
          label: `${name} - Garba & Raas Workshop (${dateLabel})`,
          sku: 'GARBA_WORKSHOP',
          quantity: 1,
          unitCents,
          subtotalCents: unitCents,
          date: ws.day,
          attendeeName: name,
        });
      }
    }
  }

  lineItems.push(...extrasLineItems);
  const extrasSubtotalCents = extrasLineItems.reduce((sum, item) => sum + item.subtotalCents, 0);
  const grossSubtotalCents = ticketsSubtotalCents + extrasSubtotalCents;

  // 4. Promo Code Evaluation
  let promoResult: PromoResult | undefined;
  let rawDiscountCents = 0;

  if (input.promoCode && input.promoCode.trim().length > 0) {
    const code = input.promoCode.trim().toUpperCase();

    switch (code) {
      case 'SEVA10': {
        // 10% off entire gross subtotal
        rawDiscountCents = Math.round(grossSubtotalCents * 0.1);
        const applied = Math.min(grossSubtotalCents, rawDiscountCents);
        promoResult = {
          valid: true,
          code: 'SEVA10',
          rawDiscountCents,
          appliedDiscountCents: applied,
          description: '10% Seva community discount applied to total order',
        };
        break;
      }

      case 'FLAT20': {
        // $20 (2000 cents) flat discount off gross subtotal
        rawDiscountCents = 2000;
        const applied = Math.min(grossSubtotalCents, rawDiscountCents);
        promoResult = {
          valid: true,
          code: 'FLAT20',
          rawDiscountCents,
          appliedDiscountCents: applied,
          description: '$20.00 flat discount applied',
        };
        break;
      }

      case 'KIDSFREE': {
        // 100% off standalone DAY_CHILD and ALL_DAY_CHILD passes only. Does NOT discount FAMILY_PASS.
        let childPassesSumCents = 0;
        for (const item of lineItems) {
          if (item.sku === 'DAY_CHILD' || item.sku === 'ALL_DAY_CHILD') {
            childPassesSumCents += item.subtotalCents;
          }
        }
        rawDiscountCents = childPassesSumCents;
        const applied = Math.min(grossSubtotalCents, rawDiscountCents);
        promoResult = {
          valid: true,
          code: 'KIDSFREE',
          rawDiscountCents,
          appliedDiscountCents: applied,
          description: '100% discount on all standalone Child Day Passes and Child All-Day Passes',
        };
        break;
      }

      case 'EXPIRED5': {
        promoResult = {
          valid: false,
          code: 'EXPIRED5',
          rawDiscountCents: 0,
          appliedDiscountCents: 0,
          message: 'Promo code EXPIRED5 expired last month and is no longer valid.',
        };
        break;
      }

      case 'MAXEDOUT': {
        promoResult = {
          valid: false,
          code: 'MAXEDOUT',
          rawDiscountCents: 0,
          appliedDiscountCents: 0,
          message: 'Promo code MAXEDOUT has already reached its maximum usage limit.',
        };
        break;
      }

      default: {
        promoResult = {
          valid: false,
          code,
          rawDiscountCents: 0,
          appliedDiscountCents: 0,
          message: `Promo code "${code}" is not recognized.`,
        };
        break;
      }
    }
  }

  // 5. Discount Clamping & Final Total
  const discountCents = promoResult?.valid ? promoResult.appliedDiscountCents : 0;
  const totalCents = Math.max(0, grossSubtotalCents - discountCents);

  // 6. Smart Tips Detection
  const smartTips: SmartTip[] = [];

  // Tip A: Child Day Pass tipping point (4 or 5 days at $8 = $32 or $40 vs All-Day Child at $30)
  const childAllDayInStock = currentStock ? currentStock.ALL_DAY_CHILD > 0 : true;

  if (childAllDayInStock) {
    for (const attendee of input.attendees) {
      if (attendee.ticketAssignment.kind === 'DAY_CHILD') {
        const daysCount = attendee.ticketAssignment.days.length;
        if (daysCount >= 4) {
          const currentCostCents = daysCount * SKU_PRICES_CENTS.DAY_CHILD;
          const allDayCostCents = SKU_PRICES_CENTS.ALL_DAY_CHILD;
          const savingsCents = currentCostCents - allDayCostCents;

          smartTips.push({
            id: `child_pass_optimization_${attendee.id}`,
            message: `Tip: ${attendee.fullName} has ${daysCount} Child Day Passes ($${(currentCostCents / 100).toFixed(2)}). Switching to a Child All-Day Pass ($${(allDayCostCents / 100).toFixed(2)}) covers all 5 days and saves you $${(savingsCents / 100).toFixed(2)}!`,
            potentialSavingsCents: savingsCents,
          });
        }
      }
    }
  }

  // Tip B: KIDSFREE promo code with Family Pass
  const normalizedPromo = input.promoCode?.trim().toUpperCase();
  if (
    normalizedPromo === 'KIDSFREE' &&
    input.familyPasses &&
    input.familyPasses.length > 0
  ) {
    const numFamilyPasses = input.familyPasses.length;
    // Family pass costs $40 flat.
    // 2 Adults ($30) + 2 Children ($16 -> $0 with KIDSFREE) = $30.
    // Difference is $10 savings per pass.
    const potentialSavingsCents = numFamilyPasses * 1000;
    smartTips.push({
      id: 'family_pass_kidsfree_optimization',
      message: `Tip: With promo code KIDSFREE, purchasing individual passes (2 Adult Day Passes at $15 + 2 Child Day Passes at $0) costs $30.00, saving you $10.00 compared to each $40.00 Family Pass!`,
      potentialSavingsCents,
    });
  }

  return {
    lineItems,
    ticketsSubtotalCents,
    extrasSubtotalCents,
    grossSubtotalCents,
    promoResult,
    discountCents,
    totalCents,
    smartTips,
  };
}
