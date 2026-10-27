# Sharad Utsav 2026 — Online Ticketing System

> **Radha Krishna Temple, Allen, Texas**
> Tue 10 Nov – Sat 14 Nov 2026

**Live URL**: [https://utsav-pass.vercel.app/](https://utsav-pass.vercel.app/)

A single-page booking flow for the 5-day Sharad Utsav festival (traditional Garba & Raas celebration): day passes, all-day passes, family bundles, dinner plates, dandiya sticks, and a strictly-limited Garba workshop — with atomic stock management, promo codes, and a door check-in manifest.

---

## Quick Start (Local Development)

```bash
# 1. Clone & install
git clone <repo-url> && cd utsav-pass
npm install

# 2. Generate Prisma client (needed even for local SQLite mode)
npx prisma generate

# 3. Run tests (no database required — uses node:sqlite in-memory)
npm test

# 4. Start dev server
npm run dev
# → http://localhost:3000
```

No `DATABASE_URL` needed for local development. The app auto-detects the missing env var and falls back to Node.js built-in SQLite (`node:sqlite`), seeding inventory on first request.

For production (Neon PostgreSQL on Vercel):

```bash
# .env
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Production only** | Neon/Supabase PostgreSQL connection string. Omit locally for auto SQLite fallback. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional | Stripe test-mode publishable key. When set, renders Stripe Elements card form instead of the simulated test cards. |
| `STRIPE_SECRET_KEY` | Optional | Stripe secret key for server-side payment confirmation. |

### NPM Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm test` | Run Vitest suite (43 tests) |
| `npm run test:watch` | Vitest in watch mode |

---

## Architecture Overview

```
src/
├── domain/           # Pure TypeScript — zero framework dependencies
│   ├── types.ts      # Discriminated unions: tickets, extras, promos, attendees
│   ├── catalog.ts    # Authoritative prices (integer cents) & initial stock
│   ├── validators.ts # Zod schemas + structural/business rule validation
│   ├── pricing.ts    # Quote calculator, promo engine, smart tips
│   └── __tests__/    # 23 unit tests
├── db/               # Database adapters (dual-engine)
│   ├── types.ts      # DbAdapter interface contract
│   ├── sqlite-adapter.ts  # node:sqlite for local dev (BEGIN IMMEDIATE)
│   ├── prisma-adapter.ts  # Prisma + PostgreSQL for prod (FOR UPDATE)
│   └── index.ts      # Auto-selects adapter based on DATABASE_URL
├── server/           # Server-side booking service
│   ├── booking-service.ts  # Atomic transactions, idempotency, manifest builder
│   └── __tests__/          # 7 tests (concurrency, idempotency, API)
├── state/            # Client-side state machine
│   ├── booking-reducer.ts  # useReducer: 5 steps, 16+ actions, auto-reconciliation
│   └── __tests__/          # 12 reducer tests
├── components/booking/     # UI components (responsive, accessible)
│   ├── BookingHeader.tsx
│   ├── PassesStep.tsx      # Step 1: roster, tickets, family passes
│   ├── ExtrasStep.tsx      # Step 2: dandiya, dinner, workshops
│   ├── AttendeeDetailsStep.tsx  # Step 3: contact info
│   ├── PaymentStep.tsx     # Step 4: review, test cards / Stripe
│   ├── ConfirmationStep.tsx    # Step 5: receipt + manifest
│   ├── ConfirmationView.tsx    # Shared view for /bookings/[ref]
│   ├── QuoteSummaryCard.tsx    # Itemized breakdown card
│   └── EvaluatorToolsBar.tsx   # Live stock inspector + reset button
└── app/
    ├── layout.tsx      # Root layout, fonts, metadata
    ├── page.tsx        # Main booking flow (SSR + client reducer)
    ├── globals.css     # Brand tokens, utility classes
    ├── bookings/[reference]/page.tsx  # Shareable confirmation page
    └── api/
        ├── catalog/route.ts
        ├── bookings/quote/route.ts
        ├── bookings/checkout/route.ts
        ├── bookings/[reference]/route.ts
        └── admin/reset-stock/route.ts
```

---

## API Contract

### `GET /api/catalog`
Returns live inventory, prices, and festival metadata.

**Response `200`:**
```jsonc
{
  "ok": true,
  "festivalDates": ["2026-11-10", …, "2026-11-14"],
  "dateLabels": { "2026-11-10": "Tue 10 Nov", … },
  "inventory": [
    {
      "sku": "DAY_ADULT",
      "name": "Adult Day Pass",
      "unitPriceCents": 1500,
      "remaining": 380,
      "description": "Single evening general admission for ages 12 and above.",
      "datesAvailable": ["2026-11-10", …]
    }
    // … 7 more SKUs
  ]
}
```
Headers: `Cache-Control: no-store`

---

### `POST /api/bookings/quote`
Server-side pricing calculation. Does not lock stock or persist anything.

**Request body:** `BookingInput` (attendees, familyPasses, extras, promoCode)

**Response `200`:**
```jsonc
{
  "ok": true,
  "quote": {
    "lineItems": [ /* … */ ],
    "ticketsSubtotalCents": 4000,
    "extrasSubtotalCents": 500,
    "grossSubtotalCents": 4500,
    "promoResult": {
      "valid": true,
      "code": "SEVA10",
      "rawDiscountCents": 450,
      "appliedDiscountCents": 450,
      "description": "10% Seva community discount…"
    },
    "discountCents": 450,
    "totalCents": 4050,
    "smartTips": []
  }
}
```

**Error `422`:** Validation failures with `{ ok: false, errors: [{ field, message }] }`

---

### `POST /api/bookings/checkout`
Atomic booking transaction: validates, locks stock, decrements, persists booking + manifest.

**Required header:** `Idempotency-Key: <uuid>` (or body field `idempotencyKey`)

**Request body:** `BookingInput`

**Response `201` (new booking):**
```jsonc
{
  "ok": true,
  "isExisting": false,
  "booking": {
    "id": "uuid",
    "reference": "SU26-A3K7",
    "totalCents": 4050,
    "subtotalCents": 4500,
    "discountCents": 450,
    "paymentStatus": "PAID",
    "createdAt": "2026-11-01T…"
  },
  "quote": { /* full BookingQuote */ },
  "manifest": [ /* CheckInManifestItem[] */ ]
}
```

**Response `200` (idempotent replay):** Same shape, `isExisting: true`.

**Error `409`:** Out of stock — `{ ok: false, errorType: "OUT_OF_STOCK", sku, skuName, requested, remaining, message }`

**Error `422`:** Validation — `{ ok: false, errorType: "VALIDATION_ERROR", errors }`

---

### `GET /api/bookings/[reference]`
Fetch a confirmed booking by its human-readable reference (e.g., `SU26-A3K7`).

**Response `200`:**
```jsonc
{
  "ok": true,
  "booking": { "reference": "SU26-A3K7", "totalCents": 4050, … },
  "booker": { "fullName": "…", "email": "…", "phone": "…", "age": 32 },
  "quote": { /* … */ },
  "manifest": [ /* … */ ]
}
```

**Error `404`:** `{ ok: false, message: "No confirmed booking found for reference …" }`

---

### `POST /api/admin/reset-stock`
Evaluator utility — resets all inventory to initial assessment baselines and clears bookings.

**Response `200`:** `{ ok: true, message: "…", inventory: [ … ] }`

---

## Pricing Reference (Integer Cents)

| SKU | Name | Price | Initial Stock |
|-----|------|-------|---------------|
| `DAY_ADULT` | Adult Day Pass | 1500¢ (`$15.00`) | 380 |
| `DAY_CHILD` | Child Day Pass | 800¢ (`$8.00`) | 260 |
| `ALL_DAY_ADULT` | Adult All-Day Pass | 6000¢ (`$60.00`) | **0** (Sold Out) |
| `ALL_DAY_CHILD` | Child All-Day Pass | 3000¢ (`$30.00`) | 140 |
| `FAMILY_PASS` | Family Day Pass (2A + 2C, 1 day) | 4000¢ (`$40.00`) | 95 |
| `DANDIYA_STICKS` | Dandiya Sticks (pair) | 500¢ (`$5.00`) | 900 |
| `DINNER_PLATE` | Dinner Plate (per evening) | 1200¢ (`$12.00`) | 1700 |
| `GARBA_WORKSHOP` | Garba & Raas Workshop (Nov 11 or 13) | 2000¢ (`$20.00`) | **2** |

---

## Decisions I Made

### 1. Integer cents everywhere
All monetary values are `number` in integer USD cents (1500 = `$15.00`). No `Decimal`, no `BigInt`, no floats. `Math.round()` is used on the one percentage-based promo (`SEVA10`). Formatting to `$XX.XX` happens only at the UI edge via `(cents / 100).toFixed(2)`. This eliminates IEEE 754 drift entirely for the arithmetic this system actually does.

### 2. Dual-engine database (node:sqlite local / Prisma+PostgreSQL production)
Instead of forcing contributors to set up a Postgres container, local dev uses Node.js's built-in `node:sqlite` (experimental, available since Node 22). The `DbAdapter` interface is identical for both engines. Production uses Prisma with Neon Serverless PostgreSQL. The tradeoff: two adapter implementations to maintain, but zero-config local dev is worth it for an assessment project.

### 3. Discriminated unions over enums
`TicketAssignment` is a 6-variant discriminated union (`kind` field) rather than a flat `ticketType: string` + nullable fields. This makes impossible states unrepresentable — a `FAMILY_PASS_MEMBER` always has a `familyPassId` and `role`, while an `ALL_DAY_ADULT` has neither days array nor pass reference. The TypeScript compiler catches violations at build time.

### 4. Server-authoritative pricing (never trust the client)
The client sends a `BookingInput` structure (attendees, extras, promo code). It does **not** send prices, subtotals, or a total. The server re-runs the full domain validation and pricing engine, then compares the required stock against the database in a serializable transaction. Client-side quotes (shown in the Review step) are advisory only.

### 5. Single promo code per booking
The brief listed 5 promo codes, and I modeled them as a single `promoCode?: string` per booking rather than a composable discount stack. This keeps the pricing engine linear and auditable. `KIDSFREE` only targets standalone child passes (not the child portion of a Family Pass), which is called out explicitly with a Smart Tip when relevant.

### 6. No user accounts
The system is a walk-up ticket booth, not a subscription platform. The primary booker provides name, email, and phone at checkout. Bookings are retrievable by reference code (`SU26-XXXX`). This keeps the data model flat and avoids auth complexity that isn't in scope.

### 7. Idempotency keys for double-click and retry safety
Every checkout carries a client-generated UUID (`crypto.randomUUID()`) that the reducer manages. Cart-changing actions regenerate the key; contact-only edits preserve it. If the same key hits the server twice, the second call returns the existing booking without re-decrementing stock. This is the same pattern Stripe uses.

---

## Where Implementation Evolved from DESIGN.md

The initial `DESIGN.md` was written before any code. A few things shifted during implementation:

1. **Local database engine**: DESIGN.md mentioned "Prisma with SQLite for local dev". In practice, Prisma's SQLite driver doesn't support `BEGIN IMMEDIATE` or row-level `FOR UPDATE` semantics needed for atomic stock decrement. I switched to `node:sqlite` (Node.js built-in) for local dev, keeping Prisma exclusively for the production PostgreSQL path. The `DbAdapter` interface hides this from the rest of the codebase.

2. **Attendee model unified with ticket assignment**: DESIGN.md sketched a separate `TicketAllocation` table. The implementation embeds `ticketAssignment: TicketAssignment` directly on each `Attendee` as a discriminated union. This keeps the booking payload self-contained (one JSON blob) rather than requiring joins across allocation tables. The `FamilyPassInstance` is a sibling array, linked by `familyPassId`.

3. **Workshop dates as a literal union**: DESIGN.md said "validate workshop date against festival dates". The implementation narrows further — `WorkshopDate = '2026-11-11' | '2026-11-13'` is its own Zod-validated literal union, so invalid workshop dates are caught at the schema layer before business logic even runs.

4. **Smart tips on quotes**: Not in the original design. Added during implementation because the `KIDSFREE` + Family Pass interaction and the Child Day Pass tipping-point (4 days at `$8` = `$32` > All-Day `$30`) were non-obvious savings that warranted surfacing to the user.

5. **Evaluator toolbar**: Added a floating `EvaluatorToolsBar` component (not in DESIGN.md) that shows live remaining stock for every SKU and provides a one-click database reset button (`POST /api/admin/reset-stock`). This makes assessment testing dramatically faster.

6. **Instant 0ms quote reactivity**: The UI combines instantaneous pure-domain quote calculations with background server quote confirmation. Price totals update immediately at 0ms latency without waiting for network round-trips.

7. **Atomic Family Pass bundling & cascade cleanup**: Added an atomic `ADD_FAMILY_PASS_BUNDLE` action that creates the pass and links all 4 slots (2 Adults + 2 Children) as `FAMILY_PASS_MEMBER` at zero additional ticket cost. Removing the family pass cleanly cascades to remove its bundled members.

8. **"Find My Pass" lookup & session memory**: Added a navbar lookup popover and `localStorage` session memory to reopen door check-in passes after refreshing.

---

## Multi-Festival Extensibility Note

The current implementation hardcodes a single festival (`Sharad Utsav 2026`) with 5 specific dates. To support multiple festivals (e.g., Holi 2027, Diwali 2027), the natural extension would be:

```typescript
interface FestivalConfig {
  id: string;                    // 'sharad-utsav-2026'
  name: string;                  // 'Sharad Utsav 2026'
  venue: string;
  dates: readonly string[];      // ISO date array
  skuPrices: Record<string, number>;
  initialStock: Record<string, number>;
  workshopDates?: readonly string[];
  promoCodes: PromoCodeConfig[];
  theme?: BrandTheme;
}
```

The domain layer is already structured for this — `catalog.ts`, `types.ts`, and `validators.ts` reference constants that could be parameterized by a `FestivalConfig` object loaded from the database or a config file. The `FESTIVAL_DATES` const, `SKU_PRICES_CENTS` map, and `INITIAL_STOCK` map are the three values that would need to become per-festival. Everything downstream (pricing engine, validators, reducer) already treats them as injected data rather than importing string literals directly into branching logic.

---

## Test Suite

```
43 tests across 3 files — all passing

src/domain/__tests__/pricing-and-rules.test.ts   — 23 tests
src/state/__tests__/booking-reducer.test.ts       — 13 tests
src/server/__tests__/concurrency-and-api.test.ts  —  7 tests
```

Run with `npm test` (or `npm run test:watch` for TDD). No database setup required — tests use in-memory `node:sqlite`.

See [TEST-CASES.md](TEST-CASES.md) for the full edge-case matrix (28 scenarios across 6 categories).
