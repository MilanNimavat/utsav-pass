'use client';

import React, { useEffect, useReducer, useRef, useState } from 'react';
import { AttendeeDetailsStep } from '@/components/booking/AttendeeDetailsStep';
import { BookingHeader } from '@/components/booking/BookingHeader';
import { ConfirmationStep } from '@/components/booking/ConfirmationStep';
import { ExtrasStep } from '@/components/booking/ExtrasStep';
import { PassesStep } from '@/components/booking/PassesStep';
import { PaymentStep } from '@/components/booking/PaymentStep';
import { QuoteSummaryCard } from '@/components/booking/QuoteSummaryCard';
import type { BookingQuote, InventoryStock } from '@/domain/types';
import {
  bookingReducer,
  createInitialBookingState,
  stateToBookingInput,
  type FlowStep,
} from '@/state/booking-reducer';

export default function BookingPage() {
  const [state, dispatch] = useReducer(bookingReducer, undefined, createInitialBookingState);
  const [stock, setStock] = useState<InventoryStock | null>(null);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);

  // 1. Fetch live stock and catalog on mount
  useEffect(() => {
    async function loadCatalog() {
      try {
        const res = await fetch('/api/catalog');
        const data = await res.json();
        if (data.ok && Array.isArray(data.inventory)) {
          const stockMap: Record<string, number> = {};
          data.inventory.forEach((item: { sku: string; remaining: number }) => {
            stockMap[item.sku] = item.remaining;
          });
          setStock(stockMap as unknown as InventoryStock);
        }
      } catch (err) {
        console.error('Failed to load initial catalog:', err);
      }
    }
    loadCatalog();
  }, []);

  // 2. Debounce-fetch authoritative quote whenever state changes
  const quoteTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (quoteTimerRef.current) {
      clearTimeout(quoteTimerRef.current);
    }

    setIsLoadingQuote(true);

    quoteTimerRef.current = setTimeout(async () => {
      try {
        const payload = stateToBookingInput(state);
        const res = await fetch('/api/bookings/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.ok && data.quote) {
          setQuote(data.quote);
          dispatch({ type: 'SYNC_SERVER_QUOTE', quote: data.quote });
        }
      } catch (err) {
        console.error('Failed to fetch quote:', err);
      } finally {
        setIsLoadingQuote(false);
      }
    }, 150);

    return () => {
      if (quoteTimerRef.current) {
        clearTimeout(quoteTimerRef.current);
      }
    };
  }, [state.attendees, state.familyPasses, state.extras, state.promoCode]);

  // Step navigation helpers
  const handleNavigateStep = (step: FlowStep) => {
    dispatch({ type: 'SET_STEP', step });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleReset = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-primaryDark text-white flex flex-col font-sans pb-24 lg:pb-12">
      {/* Top Banner & Navigation Header */}
      <BookingHeader
        currentStep={state.step}
        onNavigateStep={handleNavigateStep}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {state.step === 'CONFIRMED' ? (
          <ConfirmationStep
            reference={state.confirmedReference || 'SU26-CONFIRMED'}
            state={state}
            dispatch={dispatch}
            onReset={handleReset}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Main Interactive Form Column (8 cols on desktop) */}
            <div className="lg:col-span-8">
              {state.step === 'GROUP_AND_PASSES' && (
                <PassesStep
                  state={state}
                  dispatch={dispatch}
                  stock={stock}
                  onProceed={() => handleNavigateStep('EXTRAS')}
                />
              )}

              {state.step === 'EXTRAS' && (
                <ExtrasStep
                  state={state}
                  dispatch={dispatch}
                  stock={stock}
                  onProceed={() => handleNavigateStep('ATTENDEE_DETAILS')}
                  onBack={() => handleNavigateStep('GROUP_AND_PASSES')}
                />
              )}

              {state.step === 'ATTENDEE_DETAILS' && (
                <AttendeeDetailsStep
                  state={state}
                  dispatch={dispatch}
                  onProceed={() => handleNavigateStep('PAYMENT')}
                  onBack={() => handleNavigateStep('EXTRAS')}
                />
              )}

              {state.step === 'PAYMENT' && (
                <PaymentStep
                  state={state}
                  dispatch={dispatch}
                  quote={quote}
                  onBack={() => handleNavigateStep('ATTENDEE_DETAILS')}
                  onSuccess={(ref) => {
                    handleNavigateStep('CONFIRMED');
                  }}
                />
              )}
            </div>

            {/* Sticky Order Summary Sidebar (4 cols on desktop) */}
            <div className="lg:col-span-4">
              <QuoteSummaryCard
                state={state}
                dispatch={dispatch}
                quote={quote}
                isLoadingQuote={isLoadingQuote}
                onProceedToPayment={() => handleNavigateStep('PAYMENT')}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 py-6 text-center text-xs text-white/50 px-4">
        <p>© 2026 Radha Krishna Temple of Dallas. All rights reserved.</p>
        <p className="mt-1">
          Sharad Utsav Cultural Festival • 1450 N Watters Rd, Allen, TX 75013 • (469) 795-9130
        </p>
      </footer>
    </div>
  );
}
