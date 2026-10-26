'use client';

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ConfirmationView } from './ConfirmationView';
import type { CheckInManifestItem } from '@/server/booking-service';
import type { BookingAction, BookingState } from '@/state/booking-reducer';

interface ConfirmationStepProps {
  reference: string;
  state: BookingState;
  dispatch: React.Dispatch<BookingAction>;
  onReset: () => void;
}

export function ConfirmationStep({
  reference,
  state,
  dispatch,
  onReset,
}: ConfirmationStepProps) {
  const [manifest, setManifest] = useState<CheckInManifestItem[]>([]);
  const [bookingData, setBookingData] = useState<{
    id: string;
    reference: string;
    totalCents: number;
    subtotalCents: number;
    discountCents: number;
    paymentStatus: string;
    createdAt: string;
  } | null>(null);
  const [bookerData, setBookerData] = useState<{
    fullName: string;
    email: string;
    phone: string;
    age: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const primaryBooker = state.attendees.find((a) => a.isPrimaryBooker) || state.attendees[0];

  useEffect(() => {
    async function loadConfirmedBooking() {
      try {
        const res = await fetch(`/api/bookings/${reference}`);
        const data = await res.json();
        if (data.ok) {
          if (data.booking) setBookingData(data.booking);
          if (data.booker) setBookerData(data.booker);
          if (data.manifest) setManifest(data.manifest);
        }
      } catch (err) {
        console.error('Error fetching confirmed booking:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfirmedBooking();
  }, [reference]);

  if (loading && !bookingData) {
    return (
      <div className="py-16 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-sm text-white/70">Generating official check-in manifest...</p>
      </div>
    );
  }

  const fallbackBooking = {
    id: 'conf-id',
    reference,
    totalCents: state.serverQuote?.totalCents ?? 0,
    subtotalCents: state.serverQuote?.grossSubtotalCents ?? 0,
    discountCents: state.serverQuote?.discountCents ?? 0,
    paymentStatus: 'PAID',
    createdAt: new Date().toISOString(),
  };

  const fallbackBooker = {
    fullName: primaryBooker.fullName,
    email: primaryBooker.email || '',
    phone: primaryBooker.phone || '',
    age: primaryBooker.age,
  };

  return (
    <ConfirmationView
      reference={reference}
      booking={bookingData || fallbackBooking}
      booker={bookerData || fallbackBooker}
      quote={state.serverQuote ?? undefined}
      manifest={manifest.length > 0 ? manifest : []}
      onBookAnother={onReset}
    />
  );
}
