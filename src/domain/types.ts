// Domain Types for Sharad Utsav 2026 Ticketing System

export const FESTIVAL_DATES = [
  '2026-11-10',
  '2026-11-11',
  '2026-11-12',
  '2026-11-13',
  '2026-11-14',
] as const;

export type FestivalDate = (typeof FESTIVAL_DATES)[number];

export const FESTIVAL_DATE_LABELS: Record<FestivalDate, string> = {
  '2026-11-10': 'Tue 10 Nov',
  '2026-11-11': 'Wed 11 Nov',
  '2026-11-12': 'Thu 12 Nov',
  '2026-11-13': 'Fri 13 Nov',
  '2026-11-14': 'Sat 14 Nov',
};

export const TICKET_SKUS = [
  'DAY_ADULT',
  'DAY_CHILD',
  'ALL_DAY_ADULT',
  'ALL_DAY_CHILD',
  'FAMILY_PASS',
] as const;

export type TicketSku = (typeof TICKET_SKUS)[number];

export const EXTRA_SKUS = [
  'DANDIYA_STICKS',
  'DINNER_PLATE',
  'GARBA_WORKSHOP',
] as const;

export type ExtraSku = (typeof EXTRA_SKUS)[number];

export const PROMO_CODES = [
  'SEVA10',
  'FLAT20',
  'KIDSFREE',
  'EXPIRED5',
  'MAXEDOUT',
] as const;

export type KnownPromoCode = (typeof PROMO_CODES)[number];

export const WORKSHOP_DATES = ['2026-11-11', '2026-11-13'] as const;
export type WorkshopDate = (typeof WORKSHOP_DATES)[number];

export type TicketAssignment =
  | { kind: 'UNDER_5_FREE'; days: FestivalDate[] }
  | { kind: 'DAY_ADULT'; days: FestivalDate[] }
  | { kind: 'DAY_CHILD'; days: FestivalDate[] }
  | { kind: 'ALL_DAY_ADULT' }
  | { kind: 'ALL_DAY_CHILD' }
  | { kind: 'FAMILY_PASS_MEMBER'; familyPassId: string; role: 'ADULT' | 'CHILD' };

export interface Attendee {
  id: string;
  fullName: string;
  age: number;
  isPrimaryBooker?: boolean;
  email?: string;
  phone?: string;
  ticketAssignment: TicketAssignment;
}

export interface FamilyPassInstance {
  id: string;
  day: FestivalDate;
}

export interface GarbaWorkshopSelection {
  attendeeId: string;
  day: WorkshopDate;
}

export interface ExtrasSelection {
  dandiyaPairs: number;
  dinnerPlatesByDay: Partial<Record<FestivalDate, number>>;
  garbaWorkshops: GarbaWorkshopSelection[];
}

export interface BookingInput {
  attendees: Attendee[];
  familyPasses?: FamilyPassInstance[];
  extras?: ExtrasSelection;
  promoCode?: string;
}

export type InventoryStock = Record<TicketSku | ExtraSku, number>;

export interface LineItem {
  id: string;
  label: string;
  sku: TicketSku | ExtraSku | 'UNDER_5_FREE';
  quantity: number;
  unitCents: number;
  subtotalCents: number;
  date?: FestivalDate;
  attendeeName?: string;
}

export interface PromoResult {
  valid: boolean;
  code: string;
  rawDiscountCents: number;
  appliedDiscountCents: number;
  message?: string;
  description?: string;
}

export interface SmartTip {
  id: string;
  message: string;
  potentialSavingsCents?: number;
}

export interface BookingQuote {
  lineItems: LineItem[];
  ticketsSubtotalCents: number;
  extrasSubtotalCents: number;
  grossSubtotalCents: number;
  promoResult?: PromoResult;
  discountCents: number;
  totalCents: number;
  smartTips: SmartTip[];
}
