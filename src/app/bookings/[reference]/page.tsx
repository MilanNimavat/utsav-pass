import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ConfirmationView } from '@/components/booking/ConfirmationView';
import { getBookingByReference } from '@/server/booking-service';

export const dynamic = 'force-dynamic';

interface BookingPageProps {
  params: Promise<{ reference: string }>;
}

export default async function BookingReferencePage({ params }: BookingPageProps) {
  const { reference } = await params;
  const cleanRef = reference?.trim();

  if (!cleanRef) {
    notFound();
  }

  const snapshot = await getBookingByReference(cleanRef);

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-primaryDark text-white flex items-center justify-center p-4">
        <div className="card-dark p-8 max-w-md w-full text-center space-y-4">
          <h2 className="text-xl font-heading font-bold text-white">Booking Not Found</h2>
          <p className="text-xs text-white/70">
            No confirmed ticket booking was found matching reference <strong className="text-gold font-mono">{cleanRef}</strong>.
          </p>
          <div className="pt-2">
            <Link href="/" className="btn-gold inline-block text-xs py-2 px-4">
              Return to Booking Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primaryDark text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between">
        <Link href="/" className="text-xs text-brightGold hover:underline flex items-center gap-1">
          <span>← Back to Booking Home</span>
        </Link>
        <span className="text-xs text-white/50 font-mono">Reference: {cleanRef}</span>
      </div>

      <ConfirmationView
        reference={cleanRef}
        booking={snapshot.booking}
        booker={snapshot.booker}
        quote={snapshot.quote}
        manifest={snapshot.manifest}
      />
    </div>
  );
}
