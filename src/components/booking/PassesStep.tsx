'use client';

import React from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Info,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { FESTIVAL_DATE_LABELS, FESTIVAL_DATES, type FestivalDate, type InventoryStock } from '@/domain/types';
import type { BookingAction, BookingState } from '@/state/booking-reducer';
import { formatCents } from '@/utils/format';

interface PassesStepProps {
  state: BookingState;
  dispatch: React.Dispatch<BookingAction>;
  stock: InventoryStock | null;
  onProceed: () => void;
}

export function PassesStep({ state, dispatch, stock, onProceed }: PassesStepProps) {
  const primaryBooker = state.attendees.find((a) => a.isPrimaryBooker) || state.attendees[0];

  // Helper to add a complete 4-member Family Pass
  const handleAddFamilyPassBundle = () => {
    const passId = `fp_${Date.now()}`;
    const defaultDay: FestivalDate = '2026-11-10';

    // 1. Add Family Pass instance
    dispatch({ type: 'ADD_FAMILY_PASS', id: passId, day: defaultDay });

    // 2. Check if we can assign existing members or if we need new ones
    // We add 2 Adults and 2 Children linked to this pass
    dispatch({
      type: 'ADD_ATTENDEE',
      fullName: 'Adult 1',
      age: 32,
    });
    dispatch({
      type: 'ADD_ATTENDEE',
      fullName: 'Adult 2',
      age: 30,
    });
    dispatch({
      type: 'ADD_ATTENDEE',
      fullName: 'Child 1',
      age: 8,
    });
    dispatch({
      type: 'ADD_ATTENDEE',
      fullName: 'Child 2',
      age: 6,
    });
  };

  const hasInvalidAttendance = state.attendees.some((a) => {
    if (a.ticketAssignment.kind === 'DAY_ADULT' || a.ticketAssignment.kind === 'DAY_CHILD') {
      return a.ticketAssignment.days.length === 0;
    }
    return false;
  });

  return (
    <div className="space-y-6">
      {/* Step Introduction Card */}
      <div className="card-dark p-5 sm:p-6 border-gold/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-heading font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Step 1: Group Members, Passes & Festival Days</span>
            </h2>
            <p className="text-sm text-white/70 mt-1 max-w-2xl">
              Add each attendee and their age. Ticket eligibility is determined by age. General admission passes include access to temple grounds, cultural garba/raas dancing, and entertainment.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'ADD_ATTENDEE', age: 25 })}
              className="btn-outline-gold inline-flex items-center gap-1.5 text-xs sm:text-sm py-2 px-3"
            >
              <Plus className="w-4 h-4" />
              <span>Add Person</span>
            </button>

            <button
              type="button"
              onClick={handleAddFamilyPassBundle}
              className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-gold/20 hover:bg-gold/30 border border-gold/50 text-brightGold text-xs sm:text-sm font-semibold transition-all shadow-sm"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Add Family Pass ($40 Bundle)</span>
            </button>
          </div>
        </div>

        {/* Live Catalog Stock Indicator Pill */}
        {stock && (
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2 text-xs text-white/70">
            <span className="font-semibold text-white/90">Live Available Stock:</span>
            <span className="badge-gold">
              Adult Day Passes: {stock.DAY_ADULT}
            </span>
            <span className="badge-gold">
              Child Day Passes: {stock.DAY_CHILD}
            </span>
            <span className="badge-gold">
              Child All-Day Passes: {stock.ALL_DAY_CHILD}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-error/20 text-error border border-error/30 font-medium">
              Adult All-Day: Sold Out
            </span>
          </div>
        )}
      </div>

      {/* Family Passes Section (if any configured) */}
      {state.familyPasses.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-heading font-semibold text-brightGold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Family Passes ({state.familyPasses.length})</span>
            </h3>
            <span className="text-xs text-white/60">
              $40 flat per pass • Covers 2 Adults + 2 Children for 1 day
            </span>
          </div>

          <div className="grid gap-3">
            {state.familyPasses.map((pass, pIdx) => (
              <div
                key={pass.id}
                className="card-dark p-4 border-gold/40 bg-gold/[0.03] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">Family Pass #{pIdx + 1}</span>
                    <span className="badge-gold">$40.00 Flat</span>
                  </div>
                  <p className="text-xs text-white/70 mt-1">
                    Valid for 2 adults (12+) and 2 children (5–11) on selected evening.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <label htmlFor={`fp-day-${pass.id}`} className="text-xs text-white/70">
                      Chosen Day:
                    </label>
                    <select
                      id={`fp-day-${pass.id}`}
                      value={pass.day}
                      onChange={(e) =>
                        dispatch({
                          type: 'SET_FAMILY_PASS_DAY',
                          id: pass.id,
                          day: e.target.value as FestivalDate,
                        })
                      }
                      className="bg-white/10 border border-white/20 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-gold"
                    >
                      {FESTIVAL_DATES.map((d) => (
                        <option key={d} value={d} className="bg-primaryDark text-white">
                          {FESTIVAL_DATE_LABELS[d]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'REMOVE_FAMILY_PASS', id: pass.id })}
                    className="p-1.5 text-white/50 hover:text-error hover:bg-white/5 rounded-lg transition-all"
                    title="Remove Family Pass"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Attendee Roster Cards */}
      <div className="space-y-4">
        {state.attendees.map((attendee, index) => {
          const isPrimary = attendee.isPrimaryBooker || index === 0;
          const age = attendee.age;
          const assignment = attendee.ticketAssignment;

          return (
            <div
              key={attendee.id}
              className={`card-dark p-5 transition-all duration-200 ${
                isPrimary ? 'border-primary/50' : 'border-white/15'
              }`}
            >
              {/* Attendee Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-brightGold">
                    #{index + 1}
                  </div>
                  <h4 className="font-heading font-semibold text-white">
                    {attendee.fullName.trim() || `Person #${index + 1}`}
                  </h4>

                  {isPrimary && (
                    <span className="badge-gold">
                      Primary Booker (Payer)
                    </span>
                  )}
                </div>

                {!isPrimary && state.attendees.length > 1 && (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'REMOVE_ATTENDEE', id: attendee.id })}
                    className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-error transition-colors self-start sm:self-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Name & Age Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`name-${attendee.id}`}
                    className="block text-xs font-medium text-white/80 mb-1"
                  >
                    Full Name <span className="text-primary">*</span>
                  </label>
                  <input
                    id={`name-${attendee.id}`}
                    type="text"
                    value={attendee.fullName}
                    placeholder={isPrimary ? 'Your full legal name' : 'Attendee full name'}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_ATTENDEE_AGE_OR_NAME',
                        id: attendee.id,
                        fullName: e.target.value,
                      })
                    }
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-all"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`age-${attendee.id}`}
                    className="block text-xs font-medium text-white/80 mb-1"
                  >
                    Age <span className="text-primary">*</span>
                    {isPrimary && <span className="text-[10px] text-white/50 ml-1">(18+ required)</span>}
                  </label>
                  <input
                    id={`age-${attendee.id}`}
                    type="number"
                    min={isPrimary ? 18 : 0}
                    max={120}
                    value={isNaN(age) ? '' : age}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      dispatch({
                        type: 'UPDATE_ATTENDEE_AGE_OR_NAME',
                        id: attendee.id,
                        age: isNaN(val) ? 0 : val,
                      });
                    }}
                    className={`w-full bg-white/5 border rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-gold transition-all ${
                      isPrimary && age < 18 ? 'border-error ring-1 ring-error' : 'border-white/20'
                    }`}
                  />
                </div>
              </div>

              {/* Age Eligibility Feedback & Pass Type Selection */}
              <div className="mt-4 pt-3 border-t border-white/10">
                {/* 1. Age 0–4 (Under 5 Toddler) */}
                {age < 5 && (
                  <div className="p-3 rounded-xl bg-success/10 border border-success/30 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs sm:text-sm font-semibold text-success">
                        Under 5 — Free Entry Pass
                      </div>
                      <p className="text-xs text-white/70 mt-0.5">
                        Children aged 0–4 attend for free and do not require a paid ticket. They will be registered on the volunteer check-in door manifest for headcounts.
                      </p>

                      {/* Day selection for toddler */}
                      <div className="mt-3">
                        <span className="block text-[11px] font-medium text-white/80 mb-1.5">
                          Select days this child is accompanying the group:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {FESTIVAL_DATES.map((date) => {
                            const isSelected =
                              assignment.kind === 'UNDER_5_FREE' &&
                              assignment.days.includes(date);
                            return (
                              <button
                                key={date}
                                type="button"
                                onClick={() =>
                                  dispatch({
                                    type: 'TOGGLE_ATTENDEE_DAY',
                                    attendeeId: attendee.id,
                                    day: date,
                                  })
                                }
                                className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                                  isSelected
                                    ? 'bg-success/30 border-success text-white font-medium'
                                    : 'bg-white/5 border-white/15 text-white/60 hover:text-white'
                                }`}
                              >
                                {FESTIVAL_DATE_LABELS[date]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Age 5–11 (Child Pass Options) */}
                {age >= 5 && age <= 11 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-brightGold">
                        Child Ticket Selection (Ages 5–11)
                      </span>
                      <span className="text-xs text-white/60">
                        {stock?.DAY_CHILD ?? 260} day passes remaining
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option A: Child Day Pass */}
                      <div
                        onClick={() => {
                          if (assignment.kind !== 'DAY_CHILD') {
                            dispatch({
                              type: 'SET_TICKET_ASSIGNMENT',
                              attendeeId: attendee.id,
                              assignment: {
                                kind: 'DAY_CHILD',
                                days: ['2026-11-10'],
                              },
                            });
                          }
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          assignment.kind === 'DAY_CHILD'
                            ? 'bg-primary/10 border-primary ring-1 ring-primary'
                            : 'bg-white/5 border-white/15 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-white">
                            Child Day Pass
                          </span>
                          <span className="text-sm font-bold text-brightGold">
                            $8.00 / day
                          </span>
                        </div>
                        <p className="text-xs text-white/60 mt-1">
                          Pick individual evenings. Ideal for visiting 1 to 3 days.
                        </p>
                      </div>

                      {/* Option B: Child All-Day Pass */}
                      <div
                        onClick={() => {
                          if (assignment.kind !== 'ALL_DAY_CHILD') {
                            dispatch({
                              type: 'SET_TICKET_ASSIGNMENT',
                              attendeeId: attendee.id,
                              assignment: { kind: 'ALL_DAY_CHILD' },
                            });
                          }
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          assignment.kind === 'ALL_DAY_CHILD'
                            ? 'bg-primary/10 border-primary ring-1 ring-primary'
                            : 'bg-white/5 border-white/15 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-white">
                            Child All-Day Pass
                          </span>
                          <span className="text-sm font-bold text-brightGold">
                            $30.00 flat
                          </span>
                        </div>
                        <p className="text-xs text-white/60 mt-1">
                          Covers all 5 festival evenings. Saves $10 vs 5 single day passes.
                        </p>
                      </div>
                    </div>

                    {/* Day selector if Child Day Pass selected */}
                    {assignment.kind === 'DAY_CHILD' && (
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-white/90">
                            Select festival evenings ({assignment.days.length} selected):
                          </span>
                          {assignment.days.length === 0 && (
                            <span className="text-xs text-error font-medium">
                              Select at least 1 day
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {FESTIVAL_DATES.map((date) => {
                            const isSelected = assignment.days.includes(date);
                            return (
                              <button
                                key={date}
                                type="button"
                                onClick={() =>
                                  dispatch({
                                    type: 'TOGGLE_ATTENDEE_DAY',
                                    attendeeId: attendee.id,
                                    day: date,
                                  })
                                }
                                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                                  isSelected
                                    ? 'bg-primary border-primary text-primaryDark shadow-sm'
                                    : 'bg-white/5 border-white/15 text-white/70 hover:text-white'
                                }`}
                              >
                                {FESTIVAL_DATE_LABELS[date]}
                              </button>
                            );
                          })}
                        </div>

                        {/* Smart Tip for Child Pass Tipping Point */}
                        {assignment.days.length >= 4 && (
                          <div className="mt-2 p-2.5 rounded-lg bg-gold/15 border border-gold/40 flex items-center justify-between gap-3 text-xs">
                            <span className="text-brightGold">
                              💡 {assignment.days.length} Day Passes cost ${(assignment.days.length * 8)}.00. Switching to Child All-Day Pass ($30.00) saves ${(assignment.days.length * 8) - 30}.00!
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                dispatch({
                                  type: 'SET_TICKET_ASSIGNMENT',
                                  attendeeId: attendee.id,
                                  assignment: { kind: 'ALL_DAY_CHILD' },
                                })
                              }
                              className="px-2.5 py-1 rounded bg-primary hover:bg-brightGold text-primaryDark font-bold text-[11px] whitespace-nowrap transition-all"
                            >
                              Switch to All-Day ($30)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Age 12+ (Adult Pass Options) */}
                {age >= 12 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-brightGold">
                        Adult Ticket Selection (Ages 12+)
                      </span>
                      <span className="text-xs text-white/60">
                        {stock?.DAY_ADULT ?? 380} day passes remaining
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option A: Adult Day Pass */}
                      <div
                        onClick={() => {
                          if (assignment.kind !== 'DAY_ADULT') {
                            dispatch({
                              type: 'SET_TICKET_ASSIGNMENT',
                              attendeeId: attendee.id,
                              assignment: {
                                kind: 'DAY_ADULT',
                                days: ['2026-11-10'],
                              },
                            });
                          }
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          assignment.kind === 'DAY_ADULT'
                            ? 'bg-primary/10 border-primary ring-1 ring-primary'
                            : 'bg-white/5 border-white/15 hover:border-white/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-white">
                            Adult Day Pass
                          </span>
                          <span className="text-sm font-bold text-brightGold">
                            $15.00 / day
                          </span>
                        </div>
                        <p className="text-xs text-white/60 mt-1">
                          Select 1 or more specific festival evenings.
                        </p>
                      </div>

                      {/* Option B: Adult All-Day Pass (SOLD OUT) */}
                      <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] opacity-60 cursor-not-allowed relative">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-white/70 line-through">
                            Adult All-Day Pass
                          </span>
                          <span className="badge-error text-[10px]">
                            SOLD OUT — 0 Remaining
                          </span>
                        </div>
                        <p className="text-xs text-white/50 mt-1">
                          The 5-day bundle is sold out. Please select your days using the Adult Day Pass ($15/day).
                        </p>
                      </div>
                    </div>

                    {/* Day selector if Adult Day Pass selected */}
                    {assignment.kind === 'DAY_ADULT' && (
                      <div className="p-3 bg-white/5 rounded-xl border border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-white/90">
                            Select festival evenings ({assignment.days.length} selected):
                          </span>
                          {assignment.days.length === 0 && (
                            <span className="text-xs text-error font-medium">
                              Select at least 1 day
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {FESTIVAL_DATES.map((date) => {
                            const isSelected = assignment.days.includes(date);
                            return (
                              <button
                                key={date}
                                type="button"
                                onClick={() =>
                                  dispatch({
                                    type: 'TOGGLE_ATTENDEE_DAY',
                                    attendeeId: attendee.id,
                                    day: date,
                                  })
                                }
                                className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                                  isSelected
                                    ? 'bg-primary border-primary text-primaryDark shadow-sm'
                                    : 'bg-white/5 border-white/15 text-white/70 hover:text-white'
                                }`}
                              >
                                {FESTIVAL_DATE_LABELS[date]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Primary Booker Warning if Age < 18 */}
      {primaryBooker && primaryBooker.age < 18 && (
        <div className="p-4 rounded-xl bg-error/15 border border-error/40 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-white">
            <span className="font-semibold text-error block">Primary Booker Age Notice:</span>
            The primary booker must be an adult aged 18 or older to complete the ticketing contract. Please enter an adult age for the primary booker or designate an adult in your party.
          </div>
        </div>
      )}

      {/* Step Navigation Bar */}
      <div className="pt-4 flex items-center justify-between">
        <div className="text-xs text-white/60">
          Step 1 of 4 • {state.attendees.length} attendee{state.attendees.length > 1 ? 's' : ''} in party
        </div>

        <button
          type="button"
          disabled={hasInvalidAttendance || (primaryBooker && primaryBooker.age < 18)}
          onClick={onProceed}
          className="btn-gold inline-flex items-center gap-2"
        >
          <span>Continue to Extras</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
