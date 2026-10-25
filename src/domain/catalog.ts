// Domain Catalog: Authoritative prices and initial inventory for Sharad Utsav 2026

import type { ExtraSku, InventoryStock, TicketSku } from './types';

export const SKU_PRICES_CENTS: Record<TicketSku | ExtraSku, number> = {
  DAY_ADULT: 1500, // $15.00 / day
  DAY_CHILD: 800, // $8.00 / day
  ALL_DAY_ADULT: 6000, // $60.00 flat (Sold Out)
  ALL_DAY_CHILD: 3000, // $30.00 flat
  FAMILY_PASS: 4000, // $40.00 flat (2 adults + 2 children on 1 day)
  DANDIYA_STICKS: 500, // $5.00 / pair
  DINNER_PLATE: 1200, // $12.00 / plate
  GARBA_WORKSHOP: 2000, // $20.00 / person
};

export const INITIAL_STOCK: InventoryStock = {
  DAY_ADULT: 380,
  DAY_CHILD: 260,
  ALL_DAY_ADULT: 0, // Sold out
  ALL_DAY_CHILD: 140,
  FAMILY_PASS: 95,
  DANDIYA_STICKS: 900,
  DINNER_PLATE: 1700,
  GARBA_WORKSHOP: 2, // Strictly limited
};

export const SKU_DETAILS: Record<
  TicketSku | ExtraSku,
  { name: string; description: string; unitPriceCents: number }
> = {
  DAY_ADULT: {
    name: 'Adult Day Pass',
    description: 'Single evening general admission for ages 12 and above.',
    unitPriceCents: SKU_PRICES_CENTS.DAY_ADULT,
  },
  DAY_CHILD: {
    name: 'Child Day Pass',
    description: 'Single evening general admission for ages 5 to 11.',
    unitPriceCents: SKU_PRICES_CENTS.DAY_CHILD,
  },
  ALL_DAY_ADULT: {
    name: 'Adult All-Day Pass',
    description: 'Full 5-day festival pass for adults (Ages 12+). Currently Sold Out.',
    unitPriceCents: SKU_PRICES_CENTS.ALL_DAY_ADULT,
  },
  ALL_DAY_CHILD: {
    name: 'Child All-Day Pass',
    description: 'Full 5-day festival pass for children (Ages 5-11).',
    unitPriceCents: SKU_PRICES_CENTS.ALL_DAY_CHILD,
  },
  FAMILY_PASS: {
    name: 'Family Day Pass',
    description: 'Covers exactly 2 adults and 2 children for 1 selected festival evening.',
    unitPriceCents: SKU_PRICES_CENTS.FAMILY_PASS,
  },
  DANDIYA_STICKS: {
    name: 'Dandiya Sticks (Pair)',
    description: 'Decorated wooden garba sticks for dancing.',
    unitPriceCents: SKU_PRICES_CENTS.DANDIYA_STICKS,
  },
  DINNER_PLATE: {
    name: 'Dinner Plate',
    description: 'Authentic Gujarati vegetarian dinner buffet plate for selected evening.',
    unitPriceCents: SKU_PRICES_CENTS.DINNER_PLATE,
  },
  GARBA_WORKSHOP: {
    name: 'Traditional Garba & Raas Workshop',
    description: '1-hour intensive traditional dance workshop on Nov 11 or Nov 13. Ages 5+.',
    unitPriceCents: SKU_PRICES_CENTS.GARBA_WORKSHOP,
  },
};
