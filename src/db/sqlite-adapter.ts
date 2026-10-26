// SQLite Database Adapter using Node.js built-in DatabaseSync
import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { INITIAL_STOCK, SKU_DETAILS, SKU_PRICES_CENTS } from '../domain/catalog';
import type { ExtraSku, TicketSku } from '../domain/types';
import type {
  BookingRecord,
  CreateBookingData,
  DatabaseAdapter,
  DecrementRequirement,
  InventoryItemRecord,
  TransactionResult,
} from './types';

const require = createRequire(import.meta.url);
const { DatabaseSync } = require('node:sqlite');

export class SqliteAdapter implements DatabaseAdapter {
  private db: DatabaseSyncType;

  constructor(dbPath: string = 'utsav.db') {
    this.db = new DatabaseSync(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        sku TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        priceCents INTEGER NOT NULL,
        remaining INTEGER NOT NULL CHECK (remaining >= 0),
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        reference TEXT UNIQUE NOT NULL,
        idempotencyKey TEXT UNIQUE NOT NULL,
        bookerName TEXT NOT NULL,
        bookerEmail TEXT NOT NULL,
        bookerPhone TEXT NOT NULL,
        bookerAge INTEGER NOT NULL,
        promoCode TEXT,
        subtotalCents INTEGER NOT NULL,
        discountCents INTEGER NOT NULL,
        totalCents INTEGER NOT NULL,
        paymentStatus TEXT NOT NULL DEFAULT 'PAID',
        payloadJson TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
  }

  async ensureCatalogSeeded(): Promise<void> {
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM inventory_items');
    const result = countStmt.get() as { count: number | bigint };
    const count = Number(result.count);

    if (count === 0) {
      const insertStmt = this.db.prepare(`
        INSERT INTO inventory_items (sku, name, priceCents, remaining, updatedAt)
        VALUES (?, ?, ?, ?, ?)
      `);

      const now = new Date().toISOString();
      const skus = Object.keys(INITIAL_STOCK) as (TicketSku | ExtraSku)[];

      for (const sku of skus) {
        insertStmt.run(
          sku,
          SKU_DETAILS[sku].name,
          SKU_PRICES_CENTS[sku],
          INITIAL_STOCK[sku],
          now
        );
      }
    }
  }

  async getAllInventory(): Promise<InventoryItemRecord[]> {
    const stmt = this.db.prepare('SELECT * FROM inventory_items ORDER BY sku ASC');
    const rows = stmt.all() as unknown as InventoryItemRecord[];
    return rows;
  }

  async getInventoryItem(sku: TicketSku | ExtraSku): Promise<InventoryItemRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM inventory_items WHERE sku = ?');
    const row = stmt.get(sku) as unknown as InventoryItemRecord | undefined;
    return row || null;
  }

  async getBookingByIdempotencyKey(key: string): Promise<BookingRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM bookings WHERE idempotencyKey = ?');
    const row = stmt.get(key) as unknown as BookingRecord | undefined;
    return row || null;
  }

  async getBookingByReference(reference: string): Promise<BookingRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM bookings WHERE reference = ?');
    const row = stmt.get(reference) as unknown as BookingRecord | undefined;
    return row || null;
  }

  async executeBookingTransaction(
    bookingData: CreateBookingData,
    requirements: DecrementRequirement[]
  ): Promise<TransactionResult> {
    // BEGIN IMMEDIATE locks database for writing right away
    this.db.exec('BEGIN IMMEDIATE');

    try {
      // 1. Verify and conditionally decrement all required SKUs
      for (const req of requirements) {
        if (req.quantity <= 0) continue;

        const checkStmt = this.db.prepare('SELECT remaining FROM inventory_items WHERE sku = ?');
        const row = checkStmt.get(req.sku) as { remaining: number } | undefined;
        const currentRemaining = row ? row.remaining : 0;

        if (currentRemaining < req.quantity) {
          this.db.exec('ROLLBACK');
          return {
            success: false,
            error: 'OUT_OF_STOCK',
            sku: req.sku,
            requested: req.quantity,
            remaining: currentRemaining,
          };
        }

        const updateStmt = this.db.prepare(`
          UPDATE inventory_items
          SET remaining = remaining - ?, updatedAt = ?
          WHERE sku = ? AND remaining >= ?
        `);

        const now = new Date().toISOString();
        const res = updateStmt.run(req.quantity, now, req.sku, req.quantity);

        if (res.changes !== 1) {
          this.db.exec('ROLLBACK');
          return {
            success: false,
            error: 'OUT_OF_STOCK',
            sku: req.sku,
            requested: req.quantity,
            remaining: currentRemaining,
          };
        }
      }

      // 2. Insert Booking record
      const insertStmt = this.db.prepare(`
        INSERT INTO bookings (
          id, reference, idempotencyKey, bookerName, bookerEmail, bookerPhone, bookerAge,
          promoCode, subtotalCents, discountCents, totalCents, paymentStatus, payloadJson, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        bookingData.id,
        bookingData.reference,
        bookingData.idempotencyKey,
        bookingData.bookerName,
        bookingData.bookerEmail,
        bookingData.bookerPhone,
        bookingData.bookerAge,
        bookingData.promoCode,
        bookingData.subtotalCents,
        bookingData.discountCents,
        bookingData.totalCents,
        bookingData.paymentStatus,
        bookingData.payloadJson,
        bookingData.createdAt
      );

      this.db.exec('COMMIT');

      return {
        success: true,
        booking: bookingData,
      };
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignored if already rolled back
      }
      throw err;
    }
  }

  async resetDatabaseForTesting(): Promise<void> {
    this.db.exec('DELETE FROM bookings');
    this.db.exec('DELETE FROM inventory_items');
    await this.ensureCatalogSeeded();
  }
}
