'use client';

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  MapPin,
  Printer,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import type { CheckInManifestItem } from '@/server/booking-service';
import type { BookingAction, BookingState } from '@/state/booking-reducer';
import { formatCents } from '@/utils/format';

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
  const [copied, setCopied] = useState(false);
  const [manifest, setManifest] = useState<CheckInManifestItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch confirmed booking record from server
  useEffect(() => {
    async function loadConfirmedBooking() {
      try {
        const res = await fetch(`/api/bookings/${reference}`);
        const data = await res.json();
        if (data.ok && data.manifest) {
          setManifest(data.manifest);
        }
      } catch (err) {
        console.error('Error fetching confirmed booking:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConfirmedBooking();
  }, [reference]);

  const handleCopy = () => {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const primaryBooker = state.attendees.find((a) => a.isPrimaryBooker) || state.attendees[0];

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      {/* Success Celebration Card */}
      <div className="card-dark p-6 sm:p-8 text-center border-gold/50 bg-gradient-to-b from-primary/10 to-transparent space-y-4">
        <div className="w-16 h-16 rounded-full bg-success/20 border-2 border-success text-success flex items-center justify-center mx-auto shadow-lg">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/20 text-brightGold text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Official Booking Confirmed</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white">
            Jai Shri Krishna! Your Passes Are Ready
          </h2>
          <p className="text-sm text-white/70 mt-1 max-w-md mx-auto">
            A confirmation receipt and QR check-in voucher has been sent to{' '}
            <strong className="text-white">{primaryBooker.email || 'your email'}</strong>.
          </p>
        </div>

        {/* Reference Code Box */}
        <div className="inline-flex items-center gap-3 p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/20 mt-2">
          <span className="text-xs uppercase tracking-wider text-white/60">Reference Code:</span>
          <span className="font-mono text-xl sm:text-2xl font-bold text-brightGold tracking-wider">
            {reference}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
            title="Copy reference code"
          >
            {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Gate Pass & Door Check-In Manifest */}
      <div className="card-cream p-6 sm:p-8 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gold/30">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-gold">
              Gate Admission Pass • Official Manifest
            </div>
            <h3 className="heading-cream text-xl font-bold">
              Sharad Utsav 2026 Check-in Manifest
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
              <span>Print Pass</span>
            </button>
          </div>
        </div>

        {/* Gate QR Code Simulation */}
        <div className="p-4 rounded-2xl bg-white border border-gold/20 flex flex-col sm:flex-row items-center gap-4">
          <div className="w-24 h-24 bg-primaryDark/5 border border-primaryDark/10 rounded-xl flex items-center justify-center p-2 shrink-0">
            {/* SVG QR Code Simulation */}
            <QrCode className="w-20 h-20 text-primaryDark" />
          </div>

          <div className="text-xs text-primaryText space-y-1 text-center sm:text-left">
            <span className="font-semibold text-heading text-sm block">
              Digital Gate Wristband Token
            </span>
            <p>
              Present this QR code on your mobile phone or printed pass upon arrival at the temple gate. Volunteer staff will scan this code to issue color-coded wristbands.
            </p>
            <span className="text-[11px] text-primaryText/60 block font-mono">
              Token ID: {reference}-SECURE-VERIFIED
            </span>
          </div>
        </div>

        {/* Attendee Manifest Table */}
        <div className="space-y-3">
          <h4 className="font-heading font-semibold text-sm text-heading uppercase tracking-wider">
            Registered Attendees ({state.attendees.length})
          </h4>

          <div className="divide-y divide-gold/20 border border-gold/20 rounded-xl overflow-hidden bg-white/60">
            {state.attendees.map((attendee, idx) => {
              const isToddler = attendee.age < 5;
              const assignment = attendee.ticketAssignment;

              return (
                <div
                  key={attendee.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-heading">
                        {attendee.fullName || `Person #${idx + 1}`}
                      </span>
                      <span className="text-xs text-primaryText/60">
                        (Age {attendee.age})
                      </span>
                      {attendee.isPrimaryBooker && (
                        <span className="px-2 py-0.5 rounded-full bg-gold/20 text-heading text-[10px] font-semibold">
                          Booker
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {isToddler ? (
                      <span className="px-2.5 py-1 rounded-lg bg-success/20 text-success border border-success/30 text-xs font-semibold">
                        Toddler (Free Entry Wristband)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-gold/15 text-heading border border-gold/30 text-xs font-semibold">
                        {assignment.kind === 'ALL_DAY_CHILD'
                          ? 'Child All-Day Pass'
                          : assignment.kind === 'ALL_DAY_ADULT'
                            ? 'Adult All-Day Pass'
                            : assignment.kind === 'FAMILY_PASS_MEMBER'
                              ? 'Family Pass Member'
                              : assignment.kind === 'DAY_CHILD'
                                ? `Child Day Pass (${assignment.days.length}d)`
                                : `Adult Day Pass (${assignment.days.length}d)`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event Schedule & Guidelines */}
        <div className="pt-4 border-t border-gold/20 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-primaryText">
          <div>
            <span className="font-bold text-heading block mb-1">Evening Schedule:</span>
            <ul className="space-y-0.5 text-primaryText/80">
              <li>• 6:00 PM: Gates & Registration open</li>
              <li>• 6:30 PM – 9:30 PM: Gujarati Vegetarian Mahaprasad buffet</li>
              <li>• 7:00 PM – 8:00 PM: Garba & Raas Masterclass (Nov 11 & 13)</li>
              <li>• 8:00 PM – 11:30 PM: Grand Dandiya Raas with Live Orchestra</li>
            </ul>
          </div>

          <div>
            <span className="font-bold text-heading block mb-1">Temple Guidelines:</span>
            <ul className="space-y-0.5 text-primaryText/80">
              <li>• Traditional Indian attire encouraged.</li>
              <li>• Strictly vegetarian, alcohol-free, and tobacco-free premises.</li>
              <li>• Free parking available in temple designated lots.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onReset}
          className="btn-outline-gold inline-flex items-center gap-2 text-xs sm:text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Book Additional Passes for Friends or Family</span>
        </button>
      </div>
    </div>
  );
}
