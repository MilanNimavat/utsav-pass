// POST /api/bookings/quote - Pure server-side pricing quote calculation
import { NextResponse } from 'next/server';
import { calculateBookingQuote } from '@/domain/pricing';
import type { BookingInput } from '@/domain/types';
import { validateBooking } from '@/domain/validators';
import { getLiveStockMap } from '@/server/booking-service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BookingInput;

    if (!body || !body.attendees || !Array.isArray(body.attendees)) {
      return NextResponse.json(
        {
          ok: false,
          errors: [{ field: 'attendees', message: 'Attendee list is required' }],
        },
        { status: 422 }
      );
    }

    const liveStock = await getLiveStockMap();
    const validation = validateBooking(body, liveStock);

    if (!validation.valid) {
      return NextResponse.json(
        {
          ok: false,
          errors: validation.errors,
        },
        { status: 422 }
      );
    }

    const quote = calculateBookingQuote(body, liveStock);

    return NextResponse.json(
      {
        ok: true,
        quote,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Error generating quote:', error);
    return NextResponse.json(
      {
        ok: false,
        message: 'Invalid request payload or internal server error',
      },
      { status: 400 }
    );
  }
}
