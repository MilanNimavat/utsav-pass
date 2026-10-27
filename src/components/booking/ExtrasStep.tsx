'use client';

import React from 'react';
import {
  AlertCircle,
  Calendar,
  Check,
  Flame,
  Info,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Utensils,
} from 'lucide-react';
import {
  FESTIVAL_DATE_LABELS,
  FESTIVAL_DATES,
  type FestivalDate,
  type InventoryStock,
  type WorkshopDate,
} from '@/domain/types';
import { getAttendedDays } from '@/domain/validators';
import type { BookingAction, BookingState } from '@/state/booking-reducer';
import { formatCents } from '@/utils/format';

interface ExtrasStepProps {
  state: BookingState;
  dispatch: React.Dispatch<BookingAction>;
  stock: InventoryStock | null;
  onProceed: () => void;
  onBack: () => void;
}

export function ExtrasStep({ state, dispatch, stock, onProceed, onBack }: ExtrasStepProps) {
  const familyPassMap = new Map(state.familyPasses.map((p) => [p.id, p]));

  // Calculate attended dates per attendee and total group count per date
  const attendeeDaysMap = new Map<string, FestivalDate[]>();
  const attendeeCountByDay: Record<FestivalDate, number> = {
    '2026-11-10': 0,
    '2026-11-11': 0,
    '2026-11-12': 0,
    '2026-11-13': 0,
    '2026-11-14': 0,
  };

  for (const a of state.attendees) {
    const days = getAttendedDays(a, familyPassMap);
    attendeeDaysMap.set(a.id, days);
    for (const d of days) {
      attendeeCountByDay[d] = (attendeeCountByDay[d] || 0) + 1;
    }
  }

  // Active dates where at least 1 group member is visiting
  const activeFestivalDates = FESTIVAL_DATES.filter((d) => attendeeCountByDay[d] > 0);

  // Workshop capacity calculation
  const workshopRemaining = stock?.GARBA_WORKSHOP ?? 2;
  const currentSelectedWorkshopsCount = state.extras.garbaWorkshops.length;
  const isWorkshopAtCapacity = currentSelectedWorkshopsCount >= workshopRemaining;

  const handleAddDinnerForEveryone = (day: FestivalDate) => {
    const count = attendeeCountByDay[day];
    dispatch({
      type: 'SET_DINNER_PLATES_FOR_DAY',
      day,
      quantity: count,
    });
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="card-dark p-5 sm:p-6 border-gold/30">
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-white flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-primary" />
          <span>Step 2: Festival Extras & Add-Ons</span>
        </h2>
        <p className="text-sm text-white/70 mt-1 max-w-2xl">
          Enhance your Sharad Utsav experience with authentic wooden Dandiya sticks, chef-prepared Gujarati vegetarian dinner buffets, and limited-seat dance workshops.
        </p>
      </div>

      {/* 1. Dandiya Sticks Section */}
      <div className="card-dark p-5 border-white/15">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-semibold text-lg text-white">
                Dandiya Sticks (Pair)
              </span>
              <span className="badge-gold">$5.00 / pair</span>
              <span className="text-xs text-white/50">
                ({stock?.DANDIYA_STICKS ?? 900} pairs remaining)
              </span>
            </div>
            <p className="text-xs text-white/70 mt-1 max-w-xl">
              Traditional colorful wooden garba sticks with bells. Suitable for adults and children. Yours to keep!
            </p>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              type="button"
              aria-label="Decrease dandiya pairs"
              disabled={state.extras.dandiyaPairs <= 0}
              onClick={() =>
                dispatch({
                  type: 'SET_DANDIYA_QTY',
                  quantity: state.extras.dandiyaPairs - 1,
                })
              }
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-white transition-all focus:outline-none focus:ring-2 focus:ring-gold/50"
            >
              <Minus className="w-4 h-4" />
            </button>

            <span className="w-8 text-center font-bold text-lg text-white">
              {state.extras.dandiyaPairs}
            </span>

            <button
              type="button"
              aria-label="Increase dandiya pairs"
              disabled={state.extras.dandiyaPairs >= 50}
              onClick={() =>
                dispatch({
                  type: 'SET_DANDIYA_QTY',
                  quantity: state.extras.dandiyaPairs + 1,
                })
              }
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-white transition-all focus:outline-none focus:ring-2 focus:ring-gold/50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Dinner Plates Section */}
      <div className="card-dark p-5 border-white/15 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-lg text-white">
              Dinner Plate — Gujarati Vegetarian Buffet
            </h3>
            <span className="badge-gold">$12.00 / person</span>
          </div>
          <p className="text-xs text-white/70 mt-1">
            Freshly prepared sanctified Mahaprasad buffet served from 6:30 PM to 9:30 PM each evening.
            Plates can be booked up to the total number of group attendees present on each date.
          </p>
        </div>

        {activeFestivalDates.length === 0 ? (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-white/60">
            No festival days are currently selected for your group. Please pick your days in Step 1.
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {activeFestivalDates.map((day) => {
              const maxPlates = attendeeCountByDay[day];
              const currentPlates = state.extras.dinnerPlatesByDay[day] || 0;

              return (
                <div
                  key={day}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-white">
                        {FESTIVAL_DATE_LABELS[day]}
                      </span>
                      <span className="text-xs text-white/50">
                        ({maxPlates} member{maxPlates > 1 ? 's' : ''} attending)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Quick Button */}
                    {currentPlates < maxPlates && (
                      <button
                        type="button"
                        onClick={() => handleAddDinnerForEveryone(day)}
                        className="text-xs text-brightGold hover:underline font-medium"
                      >
                        Add for all {maxPlates}
                      </button>
                    )}

                    {/* Stepper */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease dinner plates for ${FESTIVAL_DATE_LABELS[day]}`}
                        disabled={currentPlates <= 0}
                        onClick={() =>
                          dispatch({
                            type: 'SET_DINNER_PLATES_FOR_DAY',
                            day,
                            quantity: currentPlates - 1,
                          })
                        }
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-white focus:outline-none focus:ring-2 focus:ring-gold/50"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <span className="w-6 text-center font-semibold text-sm text-white">
                        {currentPlates}
                      </span>

                      <button
                        type="button"
                        aria-label={`Increase dinner plates for ${FESTIVAL_DATE_LABELS[day]}`}
                        disabled={currentPlates >= maxPlates}
                        onClick={() =>
                          dispatch({
                            type: 'SET_DINNER_PLATES_FOR_DAY',
                            day,
                            quantity: currentPlates + 1,
                          })
                        }
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-white focus:outline-none focus:ring-2 focus:ring-gold/50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Garba Workshop Section */}
      <div className="card-dark p-5 border-white/15 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-semibold text-lg text-white">
                Traditional Garba & Raas Workshop
              </h3>
              <span className="badge-gold">$20.00 / attendee</span>
            </div>
            <p className="text-xs text-white/70 mt-1">
              1-hour intensive traditional footwork and coordination masterclass led by national Raas champions.
              Offered exclusively on <strong>Wed Nov 11</strong> and <strong>Fri Nov 13</strong>. Ages 5 and above.
            </p>
          </div>

          {/* Scarcity Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold animate-pulse self-start sm:self-auto">
            <Flame className="w-4 h-4 text-amber-400" />
            <span>Only {workshopRemaining} spots left!</span>
          </div>
        </div>

        {/* Workshop Attendee Selection Table */}
        <div className="space-y-3 pt-2">
          {state.attendees.map((attendee) => {
            const age = attendee.age;
            const isToddler = age < 5;
            const days = attendeeDaysMap.get(attendee.id) || [];
            const attendsNov11 = days.includes('2026-11-11');
            const attendsNov13 = days.includes('2026-11-13');

            const hasNov11Workshop = state.extras.garbaWorkshops.some(
              (w) => w.attendeeId === attendee.id && w.day === '2026-11-11'
            );
            const hasNov13Workshop = state.extras.garbaWorkshops.some(
              (w) => w.attendeeId === attendee.id && w.day === '2026-11-13'
            );

            return (
              <div
                key={attendee.id}
                className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-white">
                      {attendee.fullName.trim() || 'Attendee'}
                    </span>
                    <span className="text-xs text-white/50">(Age {age})</span>
                    {isToddler && (
                      <span className="badge-error text-[10px]">
                        Under 5 (Ineligible)
                      </span>
                    )}
                  </div>
                  {isToddler ? (
                    <p className="text-[11px] text-white/50 mt-0.5">
                      Children under 5 cannot participate in the fast-paced masterclass.
                    </p>
                  ) : !attendsNov11 && !attendsNov13 ? (
                    <p className="text-[11px] text-white/50 mt-0.5">
                      Not scheduled to attend on Wed Nov 11 or Fri Nov 13.
                    </p>
                  ) : null}
                </div>

                {/* Workshop Date Checkbox Buttons */}
                {!isToddler && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Wed Nov 11 Workshop */}
                    <button
                      type="button"
                      disabled={!attendsNov11 || (!hasNov11Workshop && isWorkshopAtCapacity)}
                      onClick={() =>
                        dispatch({
                          type: 'TOGGLE_GARBA_WORKSHOP',
                          attendeeId: attendee.id,
                          day: '2026-11-11',
                        })
                      }
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
                        hasNov11Workshop
                          ? 'bg-primary border-primary text-primaryDark shadow-sm'
                          : attendsNov11
                            ? 'bg-white/5 border-white/15 text-white/70 hover:text-white'
                            : 'opacity-30 cursor-not-allowed border-white/5 text-white/40'
                      }`}
                    >
                      {hasNov11Workshop && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      <span>Wed Nov 11 ($20)</span>
                    </button>

                    {/* Fri Nov 13 Workshop */}
                    <button
                      type="button"
                      disabled={!attendsNov13 || (!hasNov13Workshop && isWorkshopAtCapacity)}
                      onClick={() =>
                        dispatch({
                          type: 'TOGGLE_GARBA_WORKSHOP',
                          attendeeId: attendee.id,
                          day: '2026-11-13',
                        })
                      }
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
                        hasNov13Workshop
                          ? 'bg-primary border-primary text-primaryDark shadow-sm'
                          : attendsNov13
                            ? 'bg-white/5 border-white/15 text-white/70 hover:text-white'
                            : 'opacity-30 cursor-not-allowed border-white/5 text-white/40'
                      }`}
                    >
                      {hasNov13Workshop && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      <span>Fri Nov 13 ($20)</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {isWorkshopAtCapacity && (
          <div className="p-3 rounded-lg bg-gold/15 border border-gold/40 text-xs text-brightGold flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              You have selected all {workshopRemaining} remaining spots for the Garba Workshop. Further spots are locked.
            </span>
          </div>
        )}
      </div>

      {/* Step Navigation Bar */}
      <div className="pt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="btn-outline-gold inline-flex items-center gap-2 text-xs sm:text-sm"
        >
          <span>←</span>
          <span>Back to Passes</span>
        </button>

        <button
          type="button"
          onClick={onProceed}
          className="btn-gold inline-flex items-center gap-2"
        >
          <span>Continue to Attendee Details</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
