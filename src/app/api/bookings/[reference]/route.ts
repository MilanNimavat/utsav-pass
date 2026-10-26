// GET /api/bookings/[reference] - Fetch confirmed booking details and door check-in manifest
import { NextResponse } from 'next/server';
import { getBookingByReference } from '@/server/booking-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> | { reference: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const reference = resolvedParams?.reference?.trim();

    if (!reference) {
      return NextResponse.json(
        { ok: false, message: 'Booking reference is required' },
        { status: 400 }
      );
    }

    const snapshot = await getBookingByReference(reference);

    if (!snapshot) {
      return NextResponse.json(
        { ok: false, message: `No confirmed booking found for reference ${reference}` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        booking: {
          id: snapshot.booking.id,
          reference: snapshot.booking.reference,
          totalCents: snapshot.booking.totalCents,
          subtotalCents: snapshot.booking.subtotalCents,
          discountCents: snapshot.booking.discountCents,
          paymentStatus: snapshot.booking.paymentStatus,
          createdAt: snapshot.booking.createdAt,
        },
        booker: snapshot.booker,
        quote: snapshot.quote,
        manifest: snapshot.manifest,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching booking by reference:', error);
    return NextResponse.json(
      { ok: false, message: 'Internal server error while fetching booking' },
      { status: 500 }
    );
  }
}
