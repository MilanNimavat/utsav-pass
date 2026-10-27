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
  private schemaInitialized = false;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  private async initializeSchemaIfNeeded(): Promise<void> {
    if (this.schemaInitialized) return;
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "inventory_items" (
          "sku" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "priceCents" INTEGER NOT NULL,
          "remaining" INTEGER NOT NULL,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("sku")
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "bookings" (
          "id" TEXT NOT NULL,
          "reference" TEXT NOT NULL,
          "idempotencyKey" TEXT NOT NULL,
          "bookerName" TEXT NOT NULL,
          "bookerEmail" TEXT NOT NULL,
          "bookerPhone" TEXT NOT NULL,
          "bookerAge" INTEGER NOT NULL,
          "promoCode" TEXT,
          "subtotalCents" INTEGER NOT NULL,
          "discountCents" INTEGER NOT NULL,
          "totalCents" INTEGER NOT NULL,
          "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
          "payloadJson" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
        );
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "bookings_reference_key" ON "bookings"("reference");
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "bookings_idempotencyKey_key" ON "bookings"("idempotencyKey");
      `);

      this.schemaInitialized = true;
    } catch {
      // Proceed even if DDL execution fails (e.g. restricted permissions or handled by prisma db push)
    }
  }

  async ensureCatalogSeeded(): Promise<void> {
    await this.initializeSchemaIfNeeded();

    try {
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
    } catch (err: unknown) {
      const errorWithCode = err as { code?: string };
      // P2021: table does not exist
      if (errorWithCode?.code === 'P2021') {
        this.schemaInitialized = false;
        await this.initializeSchemaIfNeeded();
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
      } else {
        throw err;
      }
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
