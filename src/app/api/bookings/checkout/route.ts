// POST /api/bookings/checkout - Atomic checkout transaction with idempotency and stock lock
import { NextResponse } from 'next/server';
import type { BookingInput } from '@/domain/types';
import { createBookingTransaction } from '@/server/booking-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const headerKey =
      request.headers.get('idempotency-key') ||
      request.headers.get('Idempotency-Key');

    const body = (await request.json()) as BookingInput & { idempotencyKey?: string };
    const idempotencyKey = headerKey || body.idempotencyKey;

    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
      return NextResponse.json(
        {
          ok: false,
          message: 'An Idempotency-Key header or body field is required to prevent duplicate charges',
        },
        { status: 400 }
      );
    }

    const result = await createBookingTransaction(body, idempotencyKey.trim());

    if (!result.success) {
      if (result.errorType === 'VALIDATION_ERROR') {
        return NextResponse.json(
          {
            ok: false,
            errorType: 'VALIDATION_ERROR',
            errors: result.errors,
          },
          { status: 422 }
        );
      }

      if (result.errorType === 'OUT_OF_STOCK') {
        return NextResponse.json(
          {
            ok: false,
            errorType: 'OUT_OF_STOCK',
            sku: result.sku,
            skuName: result.skuName,
            requested: result.requested,
            remaining: result.remaining,
            message: result.message,
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        ok: true,
        isExisting: result.isExisting ?? false,
        booking: {
          id: result.booking.id,
          reference: result.booking.reference,
          totalCents: result.booking.totalCents,
          subtotalCents: result.booking.subtotalCents,
          discountCents: result.booking.discountCents,
          paymentStatus: result.booking.paymentStatus,
          createdAt: result.booking.createdAt,
        },
        quote: result.quote,
        manifest: result.manifest,
      },
      {
        status: result.isExisting ? 200 : 201,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Error in checkout handler:', error);
    return NextResponse.json(
      {
        ok: false,
        message: 'Internal server error while processing checkout',
      },
      { status: 500 }
    );
  }
}
