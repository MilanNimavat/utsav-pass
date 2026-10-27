'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Loader2,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import type { BookingQuote, KnownPromoCode } from '@/domain/types';
import type { BookingAction, BookingState } from '@/state/booking-reducer';
import { formatCents } from '@/utils/format';

interface QuoteSummaryCardProps {
  state: BookingState;
  dispatch: React.Dispatch<BookingAction>;
  quote: BookingQuote | null;
  isLoadingQuote: boolean;
  onProceedToPayment?: () => void;
}

const TEST_PROMO_CODES: Array<{ code: KnownPromoCode; label: string; desc: string }> = [
  { code: 'SEVA10', label: 'SEVA10', desc: '10% off entire order' },
  { code: 'FLAT20', label: 'FLAT20', desc: '$20 flat discount' },
  { code: 'KIDSFREE', label: 'KIDSFREE', desc: '100% off standalone child passes' },
  { code: 'EXPIRED5', label: 'EXPIRED5', desc: 'Expired code test' },
  { code: 'MAXEDOUT', label: 'MAXEDOUT', desc: 'Max limit test' },
];

export function QuoteSummaryCard({
  state,
  dispatch,
  quote,
  isLoadingQuote,
  onProceedToPayment,
}: QuoteSummaryCardProps) {
  const [promoInput, setPromoInput] = useState('');
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const handleApplyPromo = (code: string) => {
    dispatch({ type: 'SET_PROMO_CODE', promoCode: code });
    setPromoInput('');
  };

  const handleClearPromo = () => {
    dispatch({ type: 'SET_PROMO_CODE', promoCode: '' });
  };

  // 1-Click Convert Family Pass to Individual Passes when KIDSFREE is active
  const handleConvertFamilyPassToIndividual = () => {
    if (!state.familyPasses.length) return;
    const pass = state.familyPasses[0];
    const passDay = pass.day;

    // Remove family pass
    dispatch({ type: 'REMOVE_FAMILY_PASS', id: pass.id });

    // Ensure we have 2 adults and 2 children with DAY pass on passDay
    // All members originally on family pass or existing in attendees
    state.attendees.forEach((attendee) => {
      if (attendee.age >= 12) {
        dispatch({
          type: 'SET_TICKET_ASSIGNMENT',
          attendeeId: attendee.id,
          assignment: { kind: 'DAY_ADULT', days: [passDay] },
        });
      } else if (attendee.age >= 5) {
        dispatch({
          type: 'SET_TICKET_ASSIGNMENT',
          attendeeId: attendee.id,
          assignment: { kind: 'DAY_CHILD', days: [passDay] },
        });
      }
    });
  };

  const hasFamilyPassWithKidsFree =
    state.promoCode === 'KIDSFREE' && state.familyPasses.length > 0;

  return (
    <div className="w-full">
      {/* Desktop Card (Sticky Sidebar) */}
      <div className="hidden lg:block card-cream p-6 sticky top-28 shadow-lg">
        <div className="flex items-center justify-between pb-4 border-b border-gold/20">
          <h3 className="heading-cream text-lg font-bold flex items-center gap-2 text-heading">
            <CreditCard className="w-5 h-5 text-primary" />
            <span>Order Summary</span>
          </h3>
          {isLoadingQuote && (
            <span className="flex items-center gap-1.5 text-xs text-primary font-medium animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Updating...</span>
            </span>
          )}
        </div>

        {/* Line Items List */}
        <div className="py-4 space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {quote?.lineItems && quote.lineItems.length > 0 ? (
            quote.lineItems.map((item) => (
              <div key={item.id} className="flex items-start justify-between text-xs gap-3">
                <div className="text-primaryText">
                  <span className="font-medium text-heading">{item.label}</span>
                  {item.quantity > 1 && (
                    <span className="text-[11px] text-primaryText/70 ml-1">
                      (x{item.quantity} @ {formatCents(item.unitCents)})
                    </span>
                  )}
                </div>
                <span className="font-semibold text-heading shrink-0">
                  {item.subtotalCents === 0 ? 'FREE' : formatCents(item.subtotalCents)}
                </span>
              </div>
            ))
          ) : (
            <div className="text-xs text-primaryText/60 italic py-2">
              No items selected yet.
            </div>
          )}
        </div>

        {/* Subtotals & Discounts */}
        <div className="pt-3 border-t border-gold/20 space-y-2 text-xs">
          <div className="flex justify-between text-primaryText">
            <span>Passes & Tickets Subtotal</span>
            <span className="font-medium text-heading">
              {formatCents(quote?.ticketsSubtotalCents ?? 0)}
            </span>
          </div>

          {(quote?.extrasSubtotalCents ?? 0) > 0 && (
            <div className="flex justify-between text-primaryText">
              <span>Festival Extras Subtotal</span>
              <span className="font-medium text-heading">
                {formatCents(quote?.extrasSubtotalCents ?? 0)}
              </span>
            </div>
          )}

          {/* Applied Promo Code */}
          {quote?.promoResult && (
            <div>
              {quote.promoResult.valid ? (
                <div className="p-2.5 rounded-xl bg-success/10 border border-success/30 flex items-center justify-between text-xs text-success">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Promo {quote.promoResult.code}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">
                      -{formatCents(quote.promoResult.appliedDiscountCents)}
                    </span>
                    <button
                      type="button"
                      onClick={handleClearPromo}
                      className="text-primaryText hover:text-error"
                      title="Remove promo code"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-2 rounded-xl bg-error/10 border border-error/30 text-[11px] text-error flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{quote.promoResult.message}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Grand Total */}
        <div className="pt-4 mt-3 border-t-2 border-gold/30 flex items-baseline justify-between">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-primaryText">
              Total Amount
            </span>
            <span className="block text-[10px] text-primaryText/60">
              Zero booking fees • Includes all taxes
            </span>
          </div>
          <span className="text-2xl font-bold font-heading text-heading">
            {formatCents(quote?.totalCents ?? 0)}
          </span>
        </div>

        {/* Smart Tips Section */}
        {quote?.smartTips && quote.smartTips.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gold/20 space-y-2">
            {quote.smartTips.map((tip) => (
              <div
                key={tip.id}
                className="p-2.5 rounded-xl bg-primary/10 border border-primary/30 text-xs text-heading space-y-1.5"
              >
                <div className="flex items-start gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <span>{tip.message}</span>
                </div>

                {hasFamilyPassWithKidsFree && (
                  <button
                    type="button"
                    onClick={handleConvertFamilyPassToIndividual}
                    className="w-full text-center py-1.5 px-2 bg-primary hover:bg-brightGold text-white font-bold rounded-lg text-[11px] transition-all"
                  >
                    Convert to Individual Passes & Save $10!
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Promo Code Input Box */}
        <div className="mt-5 pt-4 border-t border-gold/20">
          <label htmlFor="desktop-promo-input" className="block text-xs font-semibold text-heading mb-1.5">
            Have a Promo or Seva Code?
          </label>
          <div className="flex gap-1.5">
            <input
              id="desktop-promo-input"
              type="text"
              value={promoInput}
              placeholder="e.g. SEVA10"
              onChange={(e) => setPromoInput(e.target.value)}
              className="flex-1 bg-white border border-gold/30 rounded-xl px-3 py-1.5 text-xs text-heading uppercase placeholder:normal-case placeholder-primaryText/40 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
            />
            <button
              type="button"
              disabled={!promoInput.trim()}
              onClick={() => handleApplyPromo(promoInput)}
              className="px-3 py-1.5 bg-primary hover:bg-brightGold text-heading font-semibold rounded-xl text-xs disabled:opacity-40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              Apply
            </button>
          </div>

          {/* Quick Demo Test Buttons */}
          <div className="mt-2.5">
            <span className="block text-[10px] text-primaryText/60 mb-1">
              Quick test codes from brief:
            </span>
            <div className="flex flex-wrap gap-1">
              {TEST_PROMO_CODES.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => handleApplyPromo(t.code)}
                  className={`text-[10px] px-2 py-0.5 rounded-md border transition-all ${
                    state.promoCode === t.code
                      ? 'bg-primary text-white border-primary font-bold'
                      : 'bg-white/60 hover:bg-white text-primaryText border-gold/30'
                  }`}
                  title={t.desc}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Drawer */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-cream border-t border-gold/30 shadow-2xl transition-all duration-300">
        {/* Toggle Bar */}
        <div
          onClick={() => setIsMobileExpanded(!isMobileExpanded)}
          className="p-3.5 flex items-center justify-between cursor-pointer border-b border-gold/20 bg-cream/95"
        >
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-sm text-heading">
              Total: {formatCents(quote?.totalCents ?? 0)}
            </span>
            {isLoadingQuote && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
          </div>

          <div className="flex items-center gap-2 text-xs text-primary font-semibold">
            <span>{isMobileExpanded ? 'Hide Details' : 'View Summary'}</span>
            {isMobileExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </div>

        {/* Collapsible Mobile Content */}
        {isMobileExpanded && (
          <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3 bg-cream text-xs text-primaryText">
            <div className="space-y-1.5 divide-y divide-gold/15">
              {quote?.lineItems?.map((item) => (
                <div key={item.id} className="pt-1.5 first:pt-0 flex justify-between">
                  <span>{item.label}</span>
                  <span className="font-medium text-heading">
                    {item.subtotalCents === 0 ? 'FREE' : formatCents(item.subtotalCents)}
                  </span>
                </div>
              ))}
            </div>

            {quote?.promoResult?.valid && (
              <div className="flex justify-between text-success font-semibold">
                <span>Discount ({quote.promoResult.code})</span>
                <span>-{formatCents(quote.promoResult.appliedDiscountCents)}</span>
              </div>
            )}

            {/* Promo input in mobile */}
            <div className="pt-2 border-t border-gold/20 flex gap-1.5">
              <input
                id="mobile-promo-input"
                aria-label="Promo or Seva Code"
                type="text"
                value={promoInput}
                placeholder="Promo Code"
                onChange={(e) => setPromoInput(e.target.value)}
                className="flex-1 bg-white border border-gold/30 rounded-lg px-2.5 py-1 text-xs text-heading uppercase focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
              />
              <button
                type="button"
                disabled={!promoInput.trim()}
                onClick={() => handleApplyPromo(promoInput)}
                className="px-3 py-1 bg-primary hover:bg-brightGold text-heading font-semibold rounded-lg text-xs disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
