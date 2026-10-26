// Prisma Database Adapter for PostgreSQL (Neon/Supabase)
import { PrismaClient } from '@prisma/client';
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

class OutOfStockException extends Error {
  constructor(
    public sku: TicketSku | ExtraSku,
    public requested: number,
    public remaining: number
  ) {
    super(`Insufficient stock for ${sku}`);
  }
}

export class PrismaAdapter implements DatabaseAdapter {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  async ensureCatalogSeeded(): Promise<void> {
    const count = await this.prisma.inventoryItem.count();
    if (count === 0) {
      const skus = Object.keys(INITIAL_STOCK) as (TicketSku | ExtraSku)[];
      await this.prisma.$transaction(
        skus.map((sku) =>
          this.prisma.inventoryItem.create({
            data: {
              sku,
              name: SKU_DETAILS[sku].name,
              priceCents: SKU_PRICES_CENTS[sku],
              remaining: INITIAL_STOCK[sku],
            },
          })
        )
      );
    }
  }

  async getAllInventory(): Promise<InventoryItemRecord[]> {
    const items = await this.prisma.inventoryItem.findMany({
      orderBy: { sku: 'asc' },
    });
    return items.map((i) => ({
      sku: i.sku as TicketSku | ExtraSku,
      name: i.name,
      priceCents: i.priceCents,
      remaining: i.remaining,
      updatedAt: i.updatedAt.toISOString(),
    }));
  }

  async getInventoryItem(sku: TicketSku | ExtraSku): Promise<InventoryItemRecord | null> {
    const item = await this.prisma.inventoryItem.findUnique({
      where: { sku },
    });
    if (!item) return null;
    return {
      sku: item.sku as TicketSku | ExtraSku,
      name: item.name,
      priceCents: item.priceCents,
      remaining: item.remaining,
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  async getBookingByIdempotencyKey(key: string): Promise<BookingRecord | null> {
    const b = await this.prisma.booking.findUnique({
      where: { idempotencyKey: key },
    });
    if (!b) return null;
    return {
      id: b.id,
      reference: b.reference,
      idempotencyKey: b.idempotencyKey,
      bookerName: b.bookerName,
      bookerEmail: b.bookerEmail,
      bookerPhone: b.bookerPhone,
      bookerAge: b.bookerAge,
      promoCode: b.promoCode,
      subtotalCents: b.subtotalCents,
      discountCents: b.discountCents,
      totalCents: b.totalCents,
      paymentStatus: b.paymentStatus as 'PAID',
      payloadJson: b.payloadJson,
      createdAt: b.createdAt.toISOString(),
    };
  }

  async getBookingByReference(reference: string): Promise<BookingRecord | null> {
    const b = await this.prisma.booking.findUnique({
      where: { reference },
    });
    if (!b) return null;
    return {
      id: b.id,
      reference: b.reference,
      idempotencyKey: b.idempotencyKey,
      bookerName: b.bookerName,
      bookerEmail: b.bookerEmail,
      bookerPhone: b.bookerPhone,
      bookerAge: b.bookerAge,
      promoCode: b.promoCode,
      subtotalCents: b.subtotalCents,
      discountCents: b.discountCents,
      totalCents: b.totalCents,
      paymentStatus: b.paymentStatus as 'PAID',
      payloadJson: b.payloadJson,
      createdAt: b.createdAt.toISOString(),
    };
  }

  async executeBookingTransaction(
    bookingData: CreateBookingData,
    requirements: DecrementRequirement[]
  ): Promise<TransactionResult> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        for (const req of requirements) {
          if (req.quantity <= 0) continue;

          // Atomic conditional update in PostgreSQL
          const affected: number = await tx.$executeRaw`
            UPDATE "inventory_items"
            SET "remaining" = "remaining" - ${req.quantity}, "updatedAt" = NOW()
            WHERE "sku" = ${req.sku} AND "remaining" >= ${req.quantity}
          `;

          if (affected !== 1) {
            const current = await tx.inventoryItem.findUnique({
              where: { sku: req.sku },
            });
            throw new OutOfStockException(
              req.sku,
              req.quantity,
              current ? current.remaining : 0
            );
          }
        }

        const b = await tx.booking.create({
          data: {
            id: bookingData.id,
            reference: bookingData.reference,
            idempotencyKey: bookingData.idempotencyKey,
            bookerName: bookingData.bookerName,
            bookerEmail: bookingData.bookerEmail,
            bookerPhone: bookingData.bookerPhone,
            bookerAge: bookingData.bookerAge,
            promoCode: bookingData.promoCode,
            subtotalCents: bookingData.subtotalCents,
            discountCents: bookingData.discountCents,
            totalCents: bookingData.totalCents,
            paymentStatus: bookingData.paymentStatus,
            payloadJson: bookingData.payloadJson,
            createdAt: new Date(bookingData.createdAt),
          },
        });

        return b;
      });

      return {
        success: true,
        booking: {
          id: created.id,
          reference: created.reference,
          idempotencyKey: created.idempotencyKey,
          bookerName: created.bookerName,
          bookerEmail: created.bookerEmail,
          bookerPhone: created.bookerPhone,
          bookerAge: created.bookerAge,
          promoCode: created.promoCode,
          subtotalCents: created.subtotalCents,
          discountCents: created.discountCents,
          totalCents: created.totalCents,
          paymentStatus: created.paymentStatus as 'PAID',
          payloadJson: created.payloadJson,
          createdAt: created.createdAt.toISOString(),
        },
      };
    } catch (err) {
      if (err instanceof OutOfStockException) {
        return {
          success: false,
          error: 'OUT_OF_STOCK',
          sku: err.sku,
          requested: err.requested,
          remaining: err.remaining,
        };
      }
      throw err;
    }
  }

  async resetDatabaseForTesting(): Promise<void> {
    await this.prisma.booking.deleteMany();
    await this.prisma.inventoryItem.deleteMany();
    await this.ensureCatalogSeeded();
  }
}
