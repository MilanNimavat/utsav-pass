'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { BookingQuote } from '@/domain/types';
import type { BookingAction, BookingState } from '@/state/booking-reducer';
import { stateToBookingInput } from '@/state/booking-reducer';
import { formatCents } from '@/utils/format';

interface PaymentStepProps {
  state: BookingState;
  dispatch: React.Dispatch<BookingAction>;
  quote: BookingQuote | null;
  onBack: () => void;
  onSuccess: (bookingRef: string) => void;
}

export function PaymentStep({
  state,
  dispatch,
  quote,
  onBack,
  onSuccess,
}: PaymentStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Simulated test card state
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('11/28');
  const [cardCvc, setCardCvc] = useState('123');
  const [zipCode, setZipCode] = useState('75013');

  const primaryBooker = state.attendees.find((a) => a.isPrimaryBooker) || state.attendees[0];
  const totalCents = quote?.totalCents ?? 0;

  const handleCheckout = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = stateToBookingInput(state);

      const res = await fetch('/api/bookings/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': state.idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          // Out of stock
          setErrorMessage(
            data.message || 'One or more items in your cart just sold out. Please review your selection.'
          );
        } else if (res.status === 422) {
          // Validation error
          const errList = data.errors?.map((e: { message: string }) => e.message).join(', ');
          setErrorMessage(errList || 'Some attendee or pass information is incomplete.');
        } else {
          setErrorMessage(data.message || 'Payment processing failed. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      // Success
      const reference = data.booking?.reference || 'SU26-CONFIRMED';
      dispatch({ type: 'SET_CONFIRMED', reference });
      onSuccess(reference);
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMessage('Network connection lost. Please verify your connection and retry.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Card */}
      <div className="card-dark p-5 sm:p-6 border-gold/30">
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <span>Step 4: Review Order & Complete Payment</span>
        </h2>
        <p className="text-sm text-white/70 mt-1">
          Review your pass allocations, catering, and workshops before confirming. Passes will be issued to{' '}
          <strong className="text-white">{primaryBooker.email || 'your email'}</strong> immediately upon payment confirmation.
        </p>
      </div>

      {/* Review Snapshot */}
      <div className="card-dark p-5 border-white/15 space-y-4">
        <h3 className="font-heading font-semibold text-base text-brightGold pb-2 border-b border-white/10">
          Booking Overview
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-white/80">
          <div>
            <span className="text-white/50 block">Primary Booker:</span>
            <span className="font-semibold text-white text-sm">
              {primaryBooker.fullName}
            </span>
            <span className="block text-white/70 mt-0.5">{primaryBooker.email}</span>
            <span className="block text-white/70">{primaryBooker.phone}</span>
          </div>

          <div>
            <span className="text-white/50 block">Group Size:</span>
            <span className="font-semibold text-white text-sm">
              {state.attendees.length} Attendee{state.attendees.length > 1 ? 's' : ''}
            </span>
            <span className="block text-white/70 mt-0.5">
              Venue: Radha Krishna Temple of Dallas, Allen, TX
            </span>
          </div>
        </div>
      </div>

      {/* Payment Form (Simulated Gateway) */}
      <div className="card-dark p-6 border-primary/40 bg-white/[0.03] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-white font-semibold text-base">
            <Lock className="w-4 h-4 text-primary" />
            <span>Secure Card Payment</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-success font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>256-Bit SSL Encrypted</span>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">
              Card Number (Test Mode Enabled)
            </label>
            <input
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-gold"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">
                Expires
              </label>
              <input
                type="text"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">
                CVC / CVV
              </label>
              <input
                type="text"
                value={cardCvc}
                onChange={(e) => setCardCvc(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">
                ZIP Code
              </label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="w-full bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-gold"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 text-[11px] text-white/50">
          This transaction is authenticated with the temple ticketing engine. Your card will be charged{' '}
          <strong className="text-white">{formatCents(totalCents)}</strong>.
        </div>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-error/15 border border-error/40 flex items-start gap-3 text-sm text-white">
          <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold text-error block">Transaction Alert:</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Action Navigation */}
      <div className="pt-4 flex items-center justify-between">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={onBack}
          className="btn-outline-gold inline-flex items-center gap-2 text-xs sm:text-sm"
        >
          <span>←</span>
          <span>Back to Details</span>
        </button>

        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleCheckout}
          className="btn-gold inline-flex items-center gap-2 py-3.5 px-8 text-base shadow-gold"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-primaryDark border-t-transparent rounded-full animate-spin" />
              <span>Securing Stock & Paying...</span>
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              <span>Pay {formatCents(totalCents)} & Confirm</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
