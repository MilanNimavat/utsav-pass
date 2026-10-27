'use client';

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Sparkles } from 'lucide-react';
import { AttendeeDetailsStep } from '@/components/booking/AttendeeDetailsStep';
import { BookingHeader } from '@/components/booking/BookingHeader';
import { ConfirmationStep } from '@/components/booking/ConfirmationStep';
import { EvaluatorToolsBar } from '@/components/booking/EvaluatorToolsBar';
import { ExtrasStep } from '@/components/booking/ExtrasStep';
import { PassesStep } from '@/components/booking/PassesStep';
import { PaymentStep } from '@/components/booking/PaymentStep';
import { QuoteSummaryCard } from '@/components/booking/QuoteSummaryCard';
import { INITIAL_STOCK } from '@/domain/catalog';
import { calculateBookingQuote } from '@/domain/pricing';
import type { BookingQuote, InventoryStock, TicketSku, ExtraSku } from '@/domain/types';
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
  const [recentRef, setRecentRef] = useState<string | null>(null);

  // Check for recently completed booking in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('utsav_last_booking_ref');
        if (stored) setRecentRef(stored);
      } catch {
        // Ignore localStorage error
      }
    }
  }, []);

  // 1. Fetch live stock and catalog
  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/catalog');
      const data = await res.json();
      if (data.ok && Array.isArray(data.inventory)) {
        const stockMap: InventoryStock = { ...INITIAL_STOCK };
        data.inventory.forEach((item: { sku: string; remaining: number }) => {
          if (item.sku in stockMap) {
            stockMap[item.sku as TicketSku | ExtraSku] = item.remaining;
          }
        });
        setStock(stockMap);
      }
    } catch (err) {
      console.error('Failed to load catalog:', err);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // 2. Real-time pure domain quote calculation (instant 0ms UI reactivity)
  const realTimeQuote = useMemo(() => {
    return calculateBookingQuote(stateToBookingInput(state), stock ?? undefined);
  }, [state, stock]);

  // 3. Debounce-fetch authoritative server quote whenever state changes
  const quoteTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (quoteTimerRef.current) {
      clearTimeout(quoteTimerRef.current);
    }

    // Reset server quote so UI seamlessly reflects new realTimeQuote instantly
    setQuote(null);
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

  // Active quote is either server-confirmed quote or instantaneous real-time quote
  const activeQuote = quote ?? realTimeQuote;

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
      {/* Recent Booking Notification Banner (if user refreshed after completing a pass) */}
      {recentRef && state.step !== 'CONFIRMED' && (
        <div className="bg-gold/15 border-b border-gold/30 px-4 py-2 text-xs flex items-center justify-center gap-2 text-white">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>Have an existing booking?</span>
          <Link
            href={`/bookings/${recentRef}`}
            className="text-brightGold font-bold hover:underline inline-flex items-center gap-1"
          >
            <span>View your pass ({recentRef})</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
          <button
            type="button"
            onClick={() => setRecentRef(null)}
            className="text-white/40 hover:text-white ml-2 text-sm leading-none"
            title="Dismiss notification"
          >
            ×
          </button>
        </div>
      )}

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
                  quote={activeQuote}
                  onBack={() => handleNavigateStep('ATTENDEE_DETAILS')}
                  onRefreshStock={loadCatalog}
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
                quote={activeQuote}
                isLoadingQuote={isLoadingQuote}
                onProceedToPayment={() => handleNavigateStep('PAYMENT')}
              />
            </div>
          </div>
        )}
      </main>

      {/* Evaluator Live Stock Inspector & Admin Tools Bar */}
      <EvaluatorToolsBar
        stock={stock}
        onStockReset={loadCatalog}
      />

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 text-center text-xs text-white/50 px-4">
        <p>© 2026 Radha Krishna Temple of Dallas. All rights reserved.</p>
        <p className="mt-1">
          Sharad Utsav Cultural Festival • 1450 N Watters Rd, Allen, TX 75013 • (469) 795-9130
        </p>
      </footer>
    </div>
  );
}
