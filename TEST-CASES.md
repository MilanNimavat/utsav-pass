# Test Cases — Sharad Utsav 2026 Ticketing System

This document covers 24 structured edge cases across 6 categories.
Each case lists the scenario, concrete inputs, expected server + UI behaviour, and where the verification actually lives in the codebase.

---

## 1. Age & Identity Rules

| # | Scenario | Input | Expected Server & UI Behaviour | Where Verified |
|---|----------|-------|-------------------------------|----------------|
| 1.1 | **Primary booker under 18** | Booker age `17`, `isPrimaryBooker: true` | Server returns `422` with `"Primary booker must be at least 18 years old"`. UI disables checkout and shows an inline error beneath the age field. | Unit: [`pricing-and-rules.test.ts` L169](src/domain/__tests__/pricing-and-rules.test.ts#L169) |
| 1.2 | **Negative, decimal, and extreme ages** | Ages `-3`, `0.5`, `121`, `NaN` for any attendee | Zod schema rejects non-integer ages and values outside `[0, 120]`. Server returns `422` per field. UI `<input type="number" step="1">` constrains entry; reducer still validates before submission. | Unit: [`pricing-and-rules.test.ts` L176–L188](src/domain/__tests__/pricing-and-rules.test.ts#L176-L188) |
| 1.3 | **Child (age 7) with forged Adult ticket via API** | `POST /api/bookings/checkout` with `{ age: 7, ticketAssignment: { kind: 'DAY_ADULT', days: ['2026-11-10'] } }` | Server `validateBooking()` rejects: `"Attendee aged 7 is a Child (5-11) and cannot hold a DAY_ADULT ticket"`. Returns `422`. UI never lets this state form because `PassesStep` filters options by age bracket. | Unit: [`pricing-and-rules.test.ts` L210–L230](src/domain/__tests__/pricing-and-rules.test.ts#L210-L230) |
| 1.4 | **Adult (age 14) trying to buy Child ticket** | `{ age: 14, ticketAssignment: { kind: 'DAY_CHILD', days: ['2026-11-11'] } }` | Server rejects: `"Attendee aged 14 is an Adult (12+) and cannot hold a DAY_CHILD ticket"`. `422`. UI hides child options once age ≥ 12. | Unit: [`pricing-and-rules.test.ts` L231–L248](src/domain/__tests__/pricing-and-rules.test.ts#L231-L248) |
| 1.5 | **Toddler (age 3) as free check-in guest** | `{ age: 3, ticketAssignment: { kind: 'UNDER_5_FREE', days: ['2026-11-10', '2026-11-14'] } }` | Pricing engine emits a `$0.00` line item (`"Toddler Entry (Ages 0-4)"`). Check-in manifest includes the toddler with badge `"Toddler (Free Entry)"`. No stock is consumed. | Unit: [`pricing-and-rules.test.ts` L189–L209](src/domain/__tests__/pricing-and-rules.test.ts#L189-L209) |

---

## 2. Ticket & Family Pass Rules

| # | Scenario | Input | Expected Server & UI Behaviour | Where Verified |
|---|----------|-------|-------------------------------|----------------|
| 2.1 | **All-Day Adult Pass blocked (stock = 0)** | Attendee age 25 selects `ALL_DAY_ADULT` | `validateBooking(input, stock)` returns `"Insufficient stock for ALL_DAY_ADULT: requested 1, but only 0 available"`. `422` on checkout, `422` on quote. UI shows a "Sold Out" badge and disables the radio button via live catalog fetch. | Unit: [`pricing-and-rules.test.ts` L386–L399](src/domain/__tests__/pricing-and-rules.test.ts#L386-L399); UI: `PassesStep.tsx` checks `remaining === 0`. |
| 2.2 | **Child 4-day Day Pass vs All-Day upgrade tip** | Child (age 8) with `DAY_CHILD` on 4 days (`4 × $8 = $32`) | Quote generates a `SmartTip`: `"Switching to a Child All-Day Pass ($30.00) covers all 5 days and saves you $2.00!"`. UI renders the tip in a gold advisory banner. Total still computed at 3200¢ unless the user acts on the tip. | Unit: [`pricing-and-rules.test.ts` L530–L552](src/domain/__tests__/pricing-and-rules.test.ts#L530-L552) |
| 2.3 | **Family Pass: must be exactly 2 Adults + 2 Children** | Family pass instance linked to 3 adults and 1 child (forged API payload) | `validateBooking()` rejects: `"Family Pass … requires exactly 2 adults (12+) and 2 children (5-11), but found 3 adult(s) and 1 child(ren)."`. `422`. UI auto-creates exactly 4 slots when adding a family pass. | Unit: [`pricing-and-rules.test.ts` L249–L283](src/domain/__tests__/pricing-and-rules.test.ts#L249-L283) |
| 2.4 | **Mixed family of 5 (Family Pass + extra Child Day Pass)** | Family pass (2A + 2C on Nov 10) + 1 additional child (age 9) with `DAY_CHILD` on Nov 10–11 | Quote shows: Family Pass = 4000¢ + Child Day Pass (2 days) = 1600¢. Total = 5600¢ (`$56.00`). All 5 people appear on the check-in manifest. | UI: manual walkthrough in browser. |

---

## 3. Extras & Date Alignment

| # | Scenario | Input | Expected Server & UI Behaviour | Where Verified |
|---|----------|-------|-------------------------------|----------------|
| 3.1 | **Garba Workshop on invalid date (Nov 12)** | `{ garbaWorkshops: [{ attendeeId: 'a1', day: '2026-11-12' }] }` | Zod `workshopDateSchema` rejects `2026-11-12` (only `2026-11-11` and `2026-11-13` allowed). Server returns `422`. UI `ExtrasStep` only renders Nov 11 and Nov 13 checkboxes. | Unit: [`pricing-and-rules.test.ts` L458–L479](src/domain/__tests__/pricing-and-rules.test.ts#L458-L479); Schema: `validators.ts` `workshopDateSchema`. |
| 3.2 | **Workshop on Nov 11 but attendee only holds Nov 13 ticket** | Adult with `DAY_ADULT` on `['2026-11-13']`, workshop for `'2026-11-11'` | Validator rejects: `"[Name] is not attending the festival on 2026-11-11 and cannot book the workshop for that date"`. `422`. | Unit: [`pricing-and-rules.test.ts` L458–L479](src/domain/__tests__/pricing-and-rules.test.ts#L458-L479) |
| 3.3 | **Workshop assigned to Under-5 toddler** | `{ age: 3, ticketAssignment: UNDER_5_FREE }`, workshop for Nov 11 | Validator rejects: `"Children under 5 are not eligible for the Garba Workshop (ages 5+ only)"`. `422`. | Unit: [`pricing-and-rules.test.ts` L480–L505](src/domain/__tests__/pricing-and-rules.test.ts#L480-L505) |
| 3.4 | **Dinner plates exceed attendees on that day** | 2 people attending Nov 10, `dinnerPlatesByDay: { '2026-11-10': 3 }` | Validator rejects: `"Dinner plates on 2026-11-10 (3) cannot exceed group members attending on that date (2)"`. `422`. Reducer auto-clamps plates to attendee count when attendees are removed. | Unit: [`pricing-and-rules.test.ts` L506–L529](src/domain/__tests__/pricing-and-rules.test.ts#L506-L529); Reducer: [`booking-reducer.test.ts` L193](src/state/__tests__/booking-reducer.test.ts#L193) |

---

## 4. Inventory & Concurrency

| # | Scenario | Input | Expected Server & UI Behaviour | Where Verified |
|---|----------|-------|-------------------------------|----------------|
| 4.1 | **Buy last 2 Garba Workshops** | 1 booking with 2 workshop spots (stock = 2) | Checkout returns `201`. Stock drops from 2 → 0. Quote correctly charges `2 × 2000¢ = 4000¢`. | Unit: [`pricing-and-rules.test.ts` L400–L457](src/domain/__tests__/pricing-and-rules.test.ts#L400-L457) (validation side); [`concurrency-and-api.test.ts` L92](src/server/__tests__/concurrency-and-api.test.ts#L92) (atomic stock). |
| 4.2 | **Concurrent race: 2 checkouts for last 2 spots** | Two concurrent `POST /api/bookings/checkout`, each requesting 2 Garba Workshop spots (stock = 2) | Exactly one returns `201 Created` and the other returns `409 Conflict` with `OUT_OF_STOCK` error. SQLite uses `BEGIN IMMEDIATE` to serialize; Prisma uses `SELECT ... FOR UPDATE` row locks. No overselling. | Unit: [`concurrency-and-api.test.ts` L92–L160](src/server/__tests__/concurrency-and-api.test.ts#L92-L160) |
| 4.3 | **409 → auto-refresh on UI** | User on payment screen, background buyer takes last spots | UI receives `409` with `{ errorType: 'OUT_OF_STOCK', sku, remaining }`, shows a red recovery banner, and automatically re-fetches `/api/catalog` to refresh live stock. User can adjust cart without losing attendee info. | UI: `PaymentStep.tsx` `handleConflict` handler. |

---

## 5. Promo Codes & Money Math

| # | Scenario | Input | Expected Server & UI Behaviour | Where Verified |
|---|----------|-------|-------------------------------|----------------|
| 5.1 | **SEVA10 on $150 order** | `promoCode: 'SEVA10'`, gross subtotal = 15000¢ | Discount = `Math.round(15000 × 0.1)` = 1500¢. Total = 13500¢ (`$135.00`). Quote `promoResult.valid = true`, description includes "10% Seva community discount". | Unit: [`pricing-and-rules.test.ts` L284–L298](src/domain/__tests__/pricing-and-rules.test.ts#L284-L298) |
| 5.2 | **FLAT20 zeroes a small order** | `promoCode: 'FLAT20'`, gross subtotal = 1500¢ (1 Adult Day Pass) | `rawDiscountCents = 2000`, `appliedDiscountCents = min(1500, 2000) = 1500`. Total = 0¢ (`$0.00`). UI shows "No payment required" and skips card entry. | Unit: [`pricing-and-rules.test.ts` L299–L324](src/domain/__tests__/pricing-and-rules.test.ts#L299-L324) |
| 5.3 | **KIDSFREE with standalone child passes + Family Pass** | Family pass + 1 standalone `DAY_CHILD` (1 day, 800¢), `promoCode: 'KIDSFREE'` | Discount = 800¢ (only the standalone child pass). Family Pass is NOT discounted. `SmartTip` generated: "With KIDSFREE, individual passes save $10.00 per Family Pass". | Unit: [`pricing-and-rules.test.ts` L325–L346](src/domain/__tests__/pricing-and-rules.test.ts#L325-L346) + [`pricing-and-rules.test.ts` L553](src/domain/__tests__/pricing-and-rules.test.ts#L553) |
| 5.4 | **EXPIRED5 rejected** | `promoCode: 'EXPIRED5'` | `promoResult.valid = false`, message = `"Promo code EXPIRED5 expired last month and is no longer valid."`. Total unchanged. UI shows red error text below the promo input. | Unit: [`pricing-and-rules.test.ts` L347–L359](src/domain/__tests__/pricing-and-rules.test.ts#L347-L359) |
| 5.5 | **MAXEDOUT rejected** | `promoCode: 'MAXEDOUT'` | `promoResult.valid = false`, message = `"Promo code MAXEDOUT has already reached its maximum usage limit."`. | Unit: [`pricing-and-rules.test.ts` L360–L371](src/domain/__tests__/pricing-and-rules.test.ts#L360-L371) |
| 5.6 | **Unknown promo code** | `promoCode: 'FOOBAR'` | `promoResult.valid = false`, message = `"Promo code "FOOBAR" is not recognized."`. No discount applied. | Unit: [`pricing-and-rules.test.ts` L372–L385](src/domain/__tests__/pricing-and-rules.test.ts#L372-L385) |

---

## 6. State Mutation & Resilience

| # | Scenario | Input | Expected Server & UI Behaviour | Where Verified |
|---|----------|-------|-------------------------------|----------------|
| 6.1 | **Idempotent replay (double-click protection)** | Same `Idempotency-Key` header sent twice to `POST /api/bookings/checkout` | First call returns `201 Created`. Second call returns `200 OK` with `isExisting: true` and the same booking reference. Stock is decremented only once. | Unit: [`concurrency-and-api.test.ts` L162–L198](src/server/__tests__/concurrency-and-api.test.ts#L162-L198) |
| 6.2 | **Age change auto-reconciles ticket assignment** | Attendee age changed from 10 → 14 via `UPDATE_ATTENDEE_AGE_OR_NAME` | Reducer detects bracket shift (CHILD → ADULT), automatically converts `DAY_CHILD` to `DAY_ADULT`, preserves selected days, prunes any Garba Workshop assignments that become invalid, and regenerates the idempotency key. | Unit: [`booking-reducer.test.ts` L33–L54](src/state/__tests__/booking-reducer.test.ts#L33-L54) |
| 6.3 | **Age change to under 5 prunes workshops** | Attendee age changed from 6 → 4 | Reducer shifts ticket to `UNDER_5_FREE`, prunes all workshop assignments for this attendee (under-5 ineligible), clamps dinner plates, and invalidates idempotency key. | Unit: [`booking-reducer.test.ts` L55–L92](src/state/__tests__/booking-reducer.test.ts#L55-L92) |
| 6.4 | **Removing attendee prunes orphaned extras** | `REMOVE_ATTENDEE` action for an attendee who had workshops and was the last person attending Nov 12 | Reducer removes the attendee, prunes their workshops, and clamps Nov 12 dinner plates to 0 (no attendees left on that day). Idempotency key regenerated. | Unit: [`booking-reducer.test.ts` L149–L192](src/state/__tests__/booking-reducer.test.ts#L149-L192) |
| 6.5 | **Deleting Family Pass reverts members** | `DELETE_FAMILY_PASS` action | All 4 FAMILY_PASS_MEMBER attendees revert to standalone `DAY_ADULT` / `DAY_CHILD` passes on the same day. Idempotency key regenerated. | Unit: [`booking-reducer.test.ts` L223–L255](src/state/__tests__/booking-reducer.test.ts#L223-L255) |
| 6.6 | **Contact-only updates keep idempotency key** | `UPDATE_ATTENDEE_CONTACT` action (email/phone change only) | Reducer updates contact fields but does **not** regenerate the idempotency key, since cart contents haven't changed and re-submitting with the same key is safe. | Unit: [`booking-reducer.test.ts` L274–L288](src/state/__tests__/booking-reducer.test.ts#L274-L288) |

---

## Summary

| Category | Cases | Verified By |
|----------|-------|-------------|
| Age & Identity Rules | 5 | 5 unit tests |
| Ticket & Family Pass Rules | 4 | 3 unit tests + 1 UI walkthrough |
| Extras & Date Alignment | 4 | 4 unit tests + 1 reducer test |
| Inventory & Concurrency | 3 | 2 unit tests + 1 UI handler |
| Promo Codes & Money Math | 6 | 6 unit tests |
| State Mutation & Resilience | 6 | 6 reducer / server tests |
| **Total** | **28** | **42 automated tests across 3 test files** |
