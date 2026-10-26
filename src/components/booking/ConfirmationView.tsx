'use client';

import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  MapPin,
  Printer,
  QrCode,
  RotateCcw,
  Shield,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { FESTIVAL_DATE_LABELS, type FestivalDate } from '@/domain/types';
import type { CheckInManifestItem } from '@/server/booking-service';
import { formatCents } from '@/utils/format';

export interface ConfirmedBookingViewProps {
  reference: string;
  booking: {
    id: string;
    reference: string;
    totalCents: number;
    subtotalCents: number;
    discountCents: number;
    paymentStatus: string;
    createdAt: string;
  };
  booker: {
    fullName: string;
    email: string;
    phone: string;
    age: number;
  };
  quote?: {
    lineItems?: Array<{
      id: string;
      label: string;
      quantity: number;
      unitCents: number;
      subtotalCents: number;
    }>;
  };
  manifest: CheckInManifestItem[];
  onBookAnother?: () => void;
}

export function ConfirmationView({
  reference,
  booking,
  booker,
  quote,
  manifest,
  onBookAnother,
}: ConfirmedBookingViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      {/* 1. Official Success Banner with #28A736 */}
      <div className="card-dark p-6 sm:p-8 text-center border-gold/40 bg-gradient-to-b from-[#28A736]/15 to-transparent space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#28A736]/20 border-2 border-[#28A736] text-[#28A736] flex items-center justify-center mx-auto shadow-lg">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/20 text-brightGold text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Official Pass Issued</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white">
            Booking Confirmed — Jai Shri Krishna!
          </h2>
          <p className="text-sm text-white/70 mt-1 max-w-md mx-auto">
            Your registration is confirmed. Confirmation details have been registered under{' '}
            <strong className="text-white">{booker.fullName}</strong> ({booker.email}).
          </p>
        </div>

        {/* Unique Booking Reference Code Pill */}
        <div className="inline-flex items-center gap-3 p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/20 mt-2">
          <span className="text-xs uppercase tracking-wider text-white/60">Booking Reference:</span>
          <span className="font-mono text-xl sm:text-2xl font-bold text-brightGold tracking-wider">
            {reference}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Copy booking reference"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. Primary Booker Official Receipt Panel */}
      <div className="card-dark p-5 border-white/15 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs">
          <span className="font-semibold text-brightGold uppercase tracking-wider">
            Payer & Transaction Receipt
          </span>
          <span className="badge-success">Status: {booking.paymentStatus}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-white/80">
          <div>
            <span className="text-white/50 block">Booker Name:</span>
            <span className="font-bold text-white text-sm">{booker.fullName}</span>
          </div>
          <div>
            <span className="text-white/50 block">Contact:</span>
            <span>{booker.email}</span>
            <span className="block text-white/60">{booker.phone}</span>
          </div>
          <div>
            <span className="text-white/50 block">Total Paid:</span>
            <span className="font-bold text-white text-base">
              {formatCents(booking.totalCents)}
            </span>
            <span className="block text-[11px] text-white/50">
              {new Date(booking.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Door Volunteer Check-In Manifest */}
      <div className="card-cream p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gold/30">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gold">
              Temple Gate Check-In Manifest • Volunteer View
            </div>
            <h3 className="heading-cream text-xl font-bold">
              Door Check-In & Wristband Issuance List
            </h3>
            <span className="text-xs text-primaryText/70">
              Radha Krishna Temple of Dallas • 1450 N Watters Rd, Allen, TX
            </span>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gold/40 text-heading hover:bg-gold/10 text-xs font-medium transition-all"
            >
              <Printer className="w-3.5 h-3.5 text-primary" />
              <span>Print Gate Pass</span>
            </button>
          </div>
        </div>

        {/* Gate QR Code Badge */}
        <div className="p-4 rounded-2xl bg-white border border-gold/20 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-24 h-24 bg-primaryDark/5 border border-primaryDark/10 rounded-xl flex items-center justify-center p-2 shrink-0">
            <QrCode className="w-20 h-20 text-primaryDark" />
          </div>

          <div className="text-xs text-primaryText space-y-1 text-center sm:text-left">
            <span className="font-semibold text-heading text-sm block">
              Volunteer Gate Scan Token
            </span>
            <p>
              Present this token to gate volunteers upon arrival. Staff will scan this QR token to issue color-coded festival wristbands and check meal ticket badges.
            </p>
            <span className="text-[11px] text-primaryText/60 block font-mono">
              Manifest ID: {reference} • {manifest.length} Attendee Badge{manifest.length > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Detailed Attendee Table */}
        <div className="space-y-3">
          <h4 className="font-heading font-semibold text-sm text-heading uppercase tracking-wider">
            Registered Attendees & Allocated Passes ({manifest.length})
          </h4>

          <div className="divide-y divide-gold/20 border border-gold/20 rounded-xl overflow-hidden bg-white/60">
            {manifest.map((item, idx) => {
              const isToddler = item.ageBracket === 'UNDER_5';

              return (
                <div key={item.attendeeId || idx} className="p-4 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gold/20 text-heading text-xs font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-sm text-heading">
                        {item.fullName}
                      </span>
                      <span className="text-xs text-primaryText/60">
                        (Age {item.age} • {item.ageBracket})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isToddler ? (
                        <span className="px-2.5 py-1 rounded-lg bg-success/20 text-success border border-success/30 text-xs font-semibold">
                          Toddler (Free Entry Wristband)
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-gold/20 text-heading border border-gold/30 text-xs font-semibold">
                          {item.badgeLabel}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Attendance Days & Extras Badges */}
                  <div className="pl-7 flex flex-wrap gap-2 text-xs text-primaryText">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-primaryText/60">Valid Dates:</span>
                      {item.attendedDays?.map((d) => (
                        <span
                          key={d}
                          className="px-2 py-0.5 rounded bg-cream border border-gold/20 text-[10px] font-medium"
                        >
                          {FESTIVAL_DATE_LABELS[d as FestivalDate] || d}
                        </span>
                      ))}
                    </div>

                    {item.workshops && item.workshops.length > 0 && (
                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-[11px] text-brightGold font-semibold">
                          ★ Garba Workshop:
                        </span>
                        {item.workshops.map((w, wIdx) => (
                          <span
                            key={wIdx}
                            className="px-2 py-0.5 rounded bg-primary/20 text-heading font-medium text-[10px]"
                          >
                            {FESTIVAL_DATE_LABELS[w.day as FestivalDate] || w.day}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.dinnerDays && item.dinnerDays.length > 0 && (
                      <div className="flex items-center gap-1 ml-2">
                        <span className="text-[11px] text-primaryText/60">🍽 Dinners:</span>
                        {item.dinnerDays.map((d) => (
                          <span
                            key={d}
                            className="px-2 py-0.5 rounded bg-white border border-gold/20 text-[10px]"
                          >
                            {FESTIVAL_DATE_LABELS[d as FestivalDate] || d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Schedule & Rules */}
        <div className="pt-4 border-t border-gold/20 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-primaryText">
          <div>
            <span className="font-bold text-heading block mb-1">Evening Program:</span>
            <ul className="space-y-0.5 text-primaryText/80">
              <li>• 6:00 PM: Doors & Gate Check-in</li>
              <li>• 6:30 PM – 9:30 PM: Gujarati Vegetarian Mahaprasad buffet</li>
              <li>• 7:00 PM – 8:00 PM: Raas Workshop (Nov 11 & 13)</li>
              <li>• 8:00 PM – 11:30 PM: Grand Garba Dancing with Live Orchestra</li>
            </ul>
          </div>

          <div>
            <span className="font-bold text-heading block mb-1">Temple Protocols:</span>
            <ul className="space-y-0.5 text-primaryText/80">
              <li>• Please carry a digital or printed copy of this manifest.</li>
              <li>• Wristbands must be worn at all times inside the temple hall.</li>
              <li>• Alcohol, smoking, and non-vegetarian food are strictly prohibited.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Book Another Pass Button */}
      {onBookAnother && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onBookAnother}
            className="btn-outline-gold inline-flex items-center gap-2 text-xs sm:text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Book Additional Passes</span>
          </button>
        </div>
      )}
    </div>
  );
}
