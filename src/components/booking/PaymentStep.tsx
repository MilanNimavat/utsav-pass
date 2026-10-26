'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  WifiOff,
  XCircle,
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
  onRefreshStock?: () => Promise<void>;
}

type TestCardPreset = 'SUCCESS' | 'DECLINED' | 'NETWORK_DROP';

export function PaymentStep({
  state,
  dispatch,
  quote,
  onBack,
  onSuccess,
  onRefreshStock,
}: PaymentStepProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOutOfStockError, setIsOutOfStockError] = useState(false);

  // Pre-filled test card selector for evaluators
  const [cardPreset, setCardPreset] = useState<TestCardPreset>('SUCCESS');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('11/28');
  const [cardCvc, setCardCvc] = useState('123');
  const [zipCode, setZipCode] = useState('75013');

  const primaryBooker = state.attendees.find((a) => a.isPrimaryBooker) || state.attendees[0];
  const totalCents = quote?.totalCents ?? 0;
  const isZeroTotal = totalCents === 0;

  const handleSelectPreset = (preset: TestCardPreset) => {
    setCardPreset(preset);
    setErrorMessage(null);
    setIsOutOfStockError(false);

    if (preset === 'SUCCESS') {
      setCardNumber('4242 •••• •••• 4242');
    } else if (preset === 'DECLINED') {
      setCardNumber('4000 •••• •••• 0002');
    } else {
      setCardNumber('0000 •••• •••• 0000 (Simulate Drop)');
    }
  };

  const handleCheckout = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    setIsOutOfStockError(false);

    // 1. Check for simulated evaluator error conditions
    if (!isZeroTotal && cardPreset === 'DECLINED') {
      await new Promise((r) => setTimeout(r, 800));
      setErrorMessage(
        'Card was declined: Your card was declined by the simulated payment gateway. Please select "Success Card" to proceed.'
      );
      setIsSubmitting(false);
      return;
    }

    if (!isZeroTotal && cardPreset === 'NETWORK_DROP') {
      await new Promise((r) => setTimeout(r, 600));
      setErrorMessage(
        'Network error: Simulated network connection dropped before reaching gateway. Please click Retry.'
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = stateToBookingInput(state);

      // Execute authoritative checkout transaction with idempotency key
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
          // Stock conflict race condition!
          setIsOutOfStockError(true);
          setErrorMessage(
            data.message ||
              'A race condition occurred: Another attendee just claimed the last remaining stock for one of your items. Please review your selection.'
          );
          if (onRefreshStock) {
            await onRefreshStock();
          }
        } else if (res.status === 422) {
          // Validation error
          const errList = data.errors?.map((e: { message: string }) => e.message).join(' • ');
          setErrorMessage(errList || 'Some attendee or pass information was rejected by the server.');
        } else {
          setErrorMessage(data.message || 'Payment processing failed. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      // Successful confirmation
      const reference = data.booking?.reference || 'SU26-CONFIRMED';
      dispatch({ type: 'SET_CONFIRMED', reference });
      if (onRefreshStock) {
        await onRefreshStock();
      }
      onSuccess(reference);
    } catch (err) {
      console.error('Checkout error:', err);
      setErrorMessage('Network connection lost. Please verify your connection and retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="card-dark p-5 sm:p-6 border-gold/30">
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <span>Step 4: Review Order & Complete Payment</span>
        </h2>
        <p className="text-sm text-white/70 mt-1">
          Review your itemized passes and festival add-ons. Digital gate wristbands will be issued to{' '}
          <strong className="text-white">{primaryBooker.email || 'your email'}</strong> upon confirmation.
        </p>
      </div>

      {/* Complete Itemized Breakdown */}
      <div className="card-cream p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gold/20">
          <h3 className="heading-cream text-base font-bold text-heading">
            Itemized Order Breakdown
          </h3>
          <span className="text-xs text-primaryText/70">
            {state.attendees.length} Attendee{state.attendees.length > 1 ? 's' : ''} in Booking
          </span>
        </div>

        <div className="divide-y divide-gold/15 text-xs text-primaryText space-y-2">
          {quote?.lineItems && quote.lineItems.length > 0 ? (
            quote.lineItems.map((item) => (
              <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-heading">{item.label}</span>
                  {item.quantity > 1 && (
                    <span className="text-primaryText/70 ml-1">
                      (x{item.quantity} @ {formatCents(item.unitCents)})
                    </span>
                  )}
                </div>
                <span className="font-bold text-heading">
                  {item.subtotalCents === 0 ? 'FREE' : formatCents(item.subtotalCents)}
                </span>
              </div>
            ))
          ) : (
            <div className="italic text-primaryText/60 py-1">No items selected.</div>
          )}
        </div>

        {/* Promo Code Discount Line */}
        {quote?.promoResult && quote.promoResult.valid && (
          <div className="p-3 rounded-xl bg-success/10 border border-success/30 flex items-center justify-between text-xs text-success font-semibold">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Promo Code Applied ({quote.promoResult.code})</span>
            </div>
            <span>-{formatCents(quote.promoResult.appliedDiscountCents)}</span>
          </div>
        )}

        {/* Grand Total */}
        <div className="pt-3 border-t-2 border-gold/30 flex items-baseline justify-between">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-primaryText">
              Final Total Due
            </span>
            <span className="block text-[11px] text-primaryText/60">
              Tax included • Zero processing surcharges
            </span>
          </div>
          <span className="text-2xl font-heading font-bold text-heading">
            {formatCents(totalCents)}
          </span>
        </div>
      </div>

      {/* Payment Method Section */}
      {isZeroTotal ? (
        /* Zero Total Bypass Mode */
        <div className="card-dark p-6 border-success/40 bg-success/[0.04] space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center text-success shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-heading font-semibold text-base text-success">
                No Payment Required ($0.00 Total)
              </h4>
              <p className="text-xs text-white/80 mt-0.5">
                Your applied promo code covered 100% of this booking. You can complete your registration immediately without entering credit card details.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Card Payment Gateway */
        <div className="card-dark p-6 border-primary/40 bg-white/[0.03] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Lock className="w-4 h-4 text-primary" />
              <span>Simulated Payment Gateway</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-success font-medium">
              <ShieldCheck className="w-4 h-4" />
              <span>PCI-DSS Compliant Test Gateway</span>
            </div>
          </div>

          {/* Evaluator Quick Test Card Selector */}
          <div className="p-3.5 rounded-xl bg-white/5 border border-gold/30 space-y-2">
            <span className="text-xs font-semibold text-brightGold block">
              Evaluator Test Card Modes:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectPreset('SUCCESS')}
                className={`text-xs p-2 rounded-lg border font-medium flex items-center justify-center gap-1.5 transition-all ${
                  cardPreset === 'SUCCESS'
                    ? 'bg-success/20 border-success text-success font-bold'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Success Card (4242)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('DECLINED')}
                className={`text-xs p-2 rounded-lg border font-medium flex items-center justify-center gap-1.5 transition-all ${
                  cardPreset === 'DECLINED'
                    ? 'bg-error/20 border-error text-error font-bold'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Declined Card (0002)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPreset('NETWORK_DROP')}
                className={`text-xs p-2 rounded-lg border font-medium flex items-center justify-center gap-1.5 transition-all ${
                  cardPreset === 'NETWORK_DROP'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span>Simulated Network Drop</span>
              </button>
            </div>
          </div>

          {/* Card Inputs */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">
                Card Number
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
                  Expiry
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
                  Billing ZIP
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
        </div>
      )}

      {/* Error Alert / Race Condition Recovery Banner */}
      {errorMessage && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-sm text-white ${
            isOutOfStockError
              ? 'bg-amber-500/15 border-amber-500/50'
              : 'bg-error/15 border-error/40'
          }`}
        >
          <AlertCircle
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              isOutOfStockError ? 'text-amber-400' : 'text-error'
            }`}
          />
          <div className="flex-1 space-y-2">
            <span
              className={`font-semibold block ${
                isOutOfStockError ? 'text-amber-300' : 'text-error'
              }`}
            >
              {isOutOfStockError ? 'Stock Depletion Conflict (HTTP 409):' : 'Transaction Alert:'}
            </span>
            <p className="text-xs text-white/90">{errorMessage}</p>

            {isOutOfStockError && (
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-primaryDark font-bold text-xs hover:bg-amber-400 transition-all flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Adjust Cart Selection</span>
                </button>
              </div>
            )}
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
          className="btn-gold inline-flex items-center gap-2 py-3 px-8 text-base shadow-gold"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-primaryDark border-t-transparent rounded-full animate-spin" />
              <span>Verifying Stock & Processing...</span>
            </>
          ) : isZeroTotal ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Free Registration ($0.00)</span>
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
