# Sharad Utsav 2026 — Architecture & System Design

**Author**: Milan Nimavat  
**Project**: Sharad Utsav 2026 Ticketing & Booking System  
**Stack**: Next.js (App Router, Strict TypeScript), Tailwind CSS, Zod, Prisma + Neon PostgreSQL, Vitest

---

## 1. Domain Modelling (Tickets, People, Dates, and Prices)

The domain core lives in `/src/domain/` as pure, framework-agnostic TypeScript functions and Zod schemas. No React hooks, no Next.js server actions, and no database queries bleed into this layer.

### 1.1 Festival Dates & Temporal Boundaries

The festival runs across five contiguous evenings. Dates are represented as a compile-time string literal union:

```typescript
export const FESTIVAL_DATES = [
  "2026-11-10", // Tue - Opening Night
  "2026-11-11", // Wed - Workshop Night 1
  "2026-11-12", // Thu - Mid-week Raas
  "2026-11-13", // Fri - Workshop Night 2 & Mega Garba
  "2026-11-14", // Sat - Grand Finale
] as const;

export type FestivalDate = (typeof FESTIVAL_DATES)[number];
```

_Why not `Date` objects?_ JavaScript `Date` and `Temporal` polyfills introduce timezone drift across ISO boundaries (e.g., UTC midnight converting to the previous calendar day in local time). String literal dates eliminate date-mutation bugs and enable direct `Set` membership tests.

### 1.2 Monetary Values in Integer Cents

All currency representations (`unitPriceCents`, `subtotalCents`, `discountCents`, `totalCents`) are typed as non-negative integers representing USD cents:

- `$15.00` is represented as `1500`.
- `$0.00` is represented as `0`.
- IEEE 754 floating-point numbers are strictly forbidden in domain arithmetic to eliminate `$0.0000000000000004` rounding artifacts.
- Currency formatting (e.g., `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })`) is executed exclusively at the UI boundary.

### 1.3 People, Age Brackets & Primary Booker

Attendees are modeled as a discriminated union based on `ageBracket`:

```typescript
export type AgeBracket = "UNDER_5" | "CHILD" | "ADULT";

export interface Attendee {
  id: string; // client-generated nanoid/uuid
  fullName: string;
  age: number;
  ageBracket: AgeBracket; // UNDER_5: 0-4 | CHILD: 5-11 | ADULT: 12+
}

export interface PrimaryBooker {
  fullName: string;
  email: string;
  phone: string;
  age: number; // Must be >= 18 to enter a legally binding transaction
}
```

- `UNDER_5` (Ages 0–4): Free admission. No commercial ticket SKU is charged, but attendee details are mandatory to satisfy venue fire codes and generate door check-in badges.
- `CHILD` (Ages 5–11): Eligible for `DAY_CHILD` and `ALL_DAY_CHILD` passes, or covered by a `FAMILY_PASS`.
- `ADULT` (Ages 12+): Eligible for `DAY_ADULT` passes, or covered by a `FAMILY_PASS`. Primary booker must be 18+.

### 1.4 Ticket SKUs & Assignments

Tickets are explicitly assigned to attendees per date or across the full event:

- Individual Day Passes: `DAY_ADULT` ($15.00 / 1500¢), `DAY_CHILD` ($8.00 / 800¢). Assigned to one attendee for one specific `FestivalDate`.
- All-Day Passes: `ALL_DAY_ADULT` ($60.00 / 6000¢ - **Sold Out / 0 Stock**), `ALL_DAY_CHILD` ($30.00 / 3000¢). Grants admission across all 5 festival dates to one attendee.
- Shared Bundle (`FAMILY_PASS`): $40.00 / 4000¢ flat fee for 1 chosen `FestivalDate`. Covers exactly 2 `ADULT` attendees and 2 `CHILD` attendees. Attendees covered under a family pass on date $D$ do not purchase individual day passes for date $D$.

### 1.5 Add-ons & Extra SKUs

1. `DANDIYA_STICKS`: $5.00 (500¢) per pair. Merchandise add-on. Unrestricted by date.
2. `DINNER_PLATE`: $12.00 (1200¢) per meal. Bound to a specific `FestivalDate` for venue catering volume control.
3. `GARBA_WORKSHOP`: $20.00 (2000¢) per attendee. Restricted strictly to `2026-11-11` and `2026-11-13`. Limited to attendees with `ageBracket !== 'UNDER_5'` who hold valid event admission for that specific evening.

---

## 2. API Endpoints & Payload Shapes

The API operates under strict server authority: the server re-calculates all sums, verifies stock availability, checks date constraints, and applies discounts inside ACID database transactions.

### 2.1 `GET /api/catalog`

Returns available festival dates, unit pricing in cents, and live remaining stock for all 8 inventory SKUs.

- **Response `200 OK`**:

```typescript
{
  festivalDates: FestivalDate[];
  inventory: {
    sku: string;
    name: string;
    unitPriceCents: number;
    remaining: number;
    datesAvailable?: FestivalDate[];
  }[];
}
```

### 2.2 `POST /api/bookings/quote`

Pure pricing engine execution. Calculates itemized subtotals, validates business rules, computes discount deductions, and returns advisory warnings without mutating database state.

- **Request Payload**:

```typescript
{
  booker: PrimaryBooker;
  attendees: Attendee[];
  ticketAssignments: {
    attendeeId: string;
    ticketType: 'DAY_PASS' | 'ALL_DAY_PASS';
    dates?: FestivalDate[]; // required if DAY_PASS
  }[];
  familyPasses: {
    id: string;
    date: FestivalDate;
    adultAttendeeIds: [string, string]; // exactly 2
    childAttendeeIds: [string, string]; // exactly 2
  }[];
  extras: {
    sku: 'DANDIYA_STICKS' | 'DINNER_PLATE' | 'GARBA_WORKSHOP';
    quantity: number;
    date?: FestivalDate; // required for DINNER_PLATE & GARBA_WORKSHOP
    attendeeId?: string; // required for GARBA_WORKSHOP
  }[];
  promoCode?: string;
}
```

- **Response `200 OK`**:

```typescript
{
  valid: true;
  lineItems: {
    description: string;
    sku: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
  }[];
  subtotalCents: number;
  discount: {
    code: string;
    description: string;
    discountCents: number;
  } | null;
  totalCents: number;
  warnings: {
    code: 'CHILD_PASS_OPTIMIZATION' | 'PROMO_FAMILY_PASS_INEFFICIENCY';
    message: string;
  }[];
}
```

- **Response `422 Unprocessable Entity`**: Returns `{ valid: false, errors: { path: string; message: string }[] }` on validation failures (e.g., booker under 18, workshop assigned to toddler, or mismatched family pass attendees).

### 2.3 `POST /api/bookings/checkout`

Executes order finalization inside a PostgreSQL transaction.

- **Headers**: `Idempotency-Key: <UUID>`
- **Request Payload**: Same shape as `quote`.
- **Database Transaction Flow**:
  1. Acquire lock and query inventory: `SELECT * FROM "InventoryItem" WHERE sku = :sku FOR UPDATE`.
  2. Verify all requested quantities against current `remaining`. If insufficient, abort with `409 Conflict`.
  3. Re-run pure domain quote engine to determine final `totalCents`. Client-submitted totals are ignored.
  4. Atomically decrement stock: `UPDATE "InventoryItem" SET remaining = remaining - :qty WHERE sku = :sku`.
  5. Authorize simulated/Stripe payment for `totalCents`.
  6. Insert `Booking` (status `CONFIRMED`), `Attendee`, `TicketAllocation`, and `AddOnAllocation` records.
- **Response `201 Created`**:

```typescript
{
  bookingReference: "UTSAV-9B24X";
  status: "CONFIRMED";
  totalCents: number;
  qrPayload: string; // Cryptographic check-in token
  createdAt: string;
}
```

### 2.4 `GET /api/bookings/[reference]`

Returns the confirmed booking summary and door manifest.

- **Response `200 OK`**: Contains booker details, payment status, full itemized receipt, and attendee door list with check-in badges (including `UNDER_5` free entries).

---

## 3. Tricky Cases Spotted Ahead of Time

### 3.1 Adult All-Day Pass Sold Out (`0` Remaining)

The inventory tracks `ALL_DAY_ADULT` at `0`. If an adult attends all 5 days, the UI and API must reject `ALL_DAY_ADULT` and guide them to select 5 individual `DAY_ADULT` passes ($15 × 5 = $75). Concurrently, children in the same booking can still select `ALL_DAY_CHILD` ($30). The system must cleanly support mixed pass selections across attendees within a single transaction.

### 3.2 Child Day Pass Pricing Tipping Point ($30 vs $32 / $40)

Individual child passes cost $8/day. If a user selects 4 days ($32) or 5 days ($40) for a child, they are paying more than the flat `ALL_DAY_CHILD` pass ($30). The quote engine returns an advisory notice:

> _"Tip: A Child All-Day Pass covers all 5 days for $30.00, saving you $2.00–$10.00."_

### 3.3 `KIDSFREE` Promo vs Family Pass ($40 Bundle)

- `KIDSFREE` zeroes out all individual `DAY_CHILD` passes ($8 → $0).
- `FAMILY_PASS` is a non-decomposable $40 flat bundle (2 Adults + 2 Children).
- If a user configures a Family Pass ($40) and applies `KIDSFREE`, applying the promo to the bundle is invalid because the bundle is a unified SKU.
- More importantly, booking 2 Adult Day Passes ($30) + 2 Child Day Passes ($0 with `KIDSFREE`) costs **$30.00**, which is **$10.00 cheaper** than the Family Pass ($40.00). The quote engine detects this condition and warns the booker.

### 3.4 `FLAT20` Floor at Zero ($0.00)

`FLAT20` grants a $20.00 (2000¢) deduction. On small orders (e.g., 1 Child Day Pass at $8 + 1 Dandiya pair at $5 = $13 / 1300¢), the discount must be clamped to the subtotal:
$$\text{discountCents} = \min(\text{subtotalCents}, 2000)$$
$$\text{totalCents} = \max(0, \text{subtotalCents} - 2000)$$
The order total floors at `$0.00` and never results in negative balances or payment gateway errors.

### 3.5 Garba Workshop Constraints & Concurrency

The Garba Workshop ($20.00) carries strict validation rules:

- **Date restriction**: Valid only on `2026-11-11` and `2026-11-13`.
- **Age restriction**: Attendee must be `CHILD` or `ADULT` (5+ years). Toddlers (`UNDER_5`) are barred.
- **Attendance prerequisite**: The assigned attendee must hold an active Day Pass, All-Day Pass, or Family Pass allocation for that exact date.
- **Scarcity**: Only 2 spots remain in total. The checkout transaction must lock the workshop inventory row (`FOR UPDATE`) to prevent double-booking race conditions under concurrent submissions.

### 3.6 Manifest Recording for Under-5 Toddlers

Toddlers enter free with no ticket charges. However, volunteer gate staff must verify headcounts against fire capacity. The checkout engine insists on capturing toddler names and ages, persisting them to the database, and issuing an `UNDER_5 (Free Entry)` wristband/badge line on the check-in manifest.

### 3.7 Mid-Flow Mutation & Stale State Pruning

If a booker fills out dates and attendee assignments, selects a workshop for Nov 11, and subsequently de-selects Nov 11 or removes that attendee from the group:

- Client-side form state immediately cascades deletions to prevent orphaned add-ons.
- Server-side validation rejects any payload where an extra references a removed date or unassigned attendee ID.

---

## 4. What I Decided NOT to Build (and Why)

1. **User Accounts, Passwords & Authentication Portals**  
   _Decision_: No user accounts, OAuth, or passwords.  
   _Rationale_: Sharad Utsav is a once-a-year community festival. Forcing attendees to register an account or verify email magic links during checkout causes massive drop-off on mobile devices. Instead, bookings issue a human-readable reference code (`UTSAV-XXXXX`) accompanied by a signed token link sent via email/SMS. Attendees can retrieve, view, and present their booking pass instantly without authentication friction.

2. **Interactive 2D/3D Seat Charts & Floor Plans**  
   _Decision_: General admission ticketing only; no seat selection.  
   _Rationale_: Garba and Raas are open-floor social folk dances, and festival dining is buffet-style. Assigned seating contradicts the operational reality of the event and introduces unnecessary rendering complexity.

3. **Multi-Promo Code Stacking**  
   _Decision_: Strictly one promo code per transaction.  
   _Rationale_: Allowing users to combine percentage discounts (`KIDSFREE`) with fixed deductions (`FLAT20`) leads to discount order ambiguity, unexpected zero-total exploits, and volunteer confusion at the registration desk. A single, transparent promo code engine ensures predictable margins and clean accounting audits.
