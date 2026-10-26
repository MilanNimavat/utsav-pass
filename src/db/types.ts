// Database Types for Sharad Utsav 2026 Ticketing System

import type { ExtraSku, TicketSku } from '../domain/types';

export interface InventoryItemRecord {
  sku: TicketSku | ExtraSku;
  name: string;
  priceCents: number;
  remaining: number;
  updatedAt: string;
}

export interface BookingRecord {
  id: string;
  reference: string;
  idempotencyKey: string;
  bookerName: string;
  bookerEmail: string;
  bookerPhone: string;
  bookerAge: number;
  promoCode: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paymentStatus: 'PAID';
  payloadJson: string;
  createdAt: string;
}

export interface CreateBookingData {
  id: string;
  reference: string;
  idempotencyKey: string;
  bookerName: string;
  bookerEmail: string;
  bookerPhone: string;
  bookerAge: number;
  promoCode: string | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paymentStatus: 'PAID';
  payloadJson: string;
  createdAt: string;
}

export interface DecrementRequirement {
  sku: TicketSku | ExtraSku;
  quantity: number;
}

export type TransactionResult =
  | { success: true; booking: BookingRecord }
  | {
      success: false;
      error: 'OUT_OF_STOCK';
      sku: TicketSku | ExtraSku;
      requested: number;
      remaining: number;
    };

export interface DatabaseAdapter {
  ensureCatalogSeeded(): Promise<void>;
  getAllInventory(): Promise<InventoryItemRecord[]>;
  getInventoryItem(sku: TicketSku | ExtraSku): Promise<InventoryItemRecord | null>;
  getBookingByIdempotencyKey(key: string): Promise<BookingRecord | null>;
  getBookingByReference(reference: string): Promise<BookingRecord | null>;
  executeBookingTransaction(
    bookingData: CreateBookingData,
    requirements: DecrementRequirement[]
  ): Promise<TransactionResult>;
  resetDatabaseForTesting?(): Promise<void>;
}
