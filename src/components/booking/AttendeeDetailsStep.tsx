'use client';

import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  Phone,
  Shield,
  User,
  Users,
} from 'lucide-react';
import type { BookingAction, BookingState } from '@/state/booking-reducer';

interface AttendeeDetailsStepProps {
  state: BookingState;
  dispatch: React.Dispatch<BookingAction>;
  onProceed: () => void;
  onBack: () => void;
}

export function AttendeeDetailsStep({
  state,
  dispatch,
  onProceed,
  onBack,
}: AttendeeDetailsStepProps) {
  const primaryBooker = state.attendees.find((a) => a.isPrimaryBooker) || state.attendees[0];

  // Validation checks
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = primaryBooker?.email ? emailRegex.test(primaryBooker.email) : false;
  const isPhoneValid = (primaryBooker?.phone?.trim().length ?? 0) >= 7;
  const isBookerAgeValid = (primaryBooker?.age ?? 0) >= 18;
  const isBookerNameValid = (primaryBooker?.fullName.trim().length ?? 0) > 0;

  const areAllAttendeeNamesProvided = state.attendees.every(
    (a) => a.fullName.trim().length > 0
  );

  const canProceed =
    isBookerNameValid &&
    isBookerAgeValid &&
    isEmailValid &&
    isPhoneValid &&
    areAllAttendeeNamesProvided;

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="card-dark p-5 sm:p-6 border-gold/30">
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          <span>Step 3: Attendee & Primary Booker Details</span>
        </h2>
        <p className="text-sm text-white/70 mt-1 max-w-2xl">
          Enter contact details for the primary ticket holder (who will receive digital passes and order receipts) and verify attendee names for gate check-in wristbands.
        </p>
      </div>

      {/* 1. Primary Booker Card */}
      <div className="card-dark p-6 border-primary/50 bg-primary/[0.02] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-brightGold" />
            <h3 className="font-heading font-semibold text-lg text-white">
              Primary Booker & Payer Contact
            </h3>
          </div>
          <span className="badge-gold">
            Must be 18+
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Booker Full Name */}
          <div>
            <label
              htmlFor="primary-booker-name"
              className="block text-xs font-medium text-white/80 mb-1"
            >
              Primary Booker Full Name <span className="text-primary">*</span>
            </label>
            <input
              id="primary-booker-name"
              type="text"
              value={primaryBooker.fullName}
              placeholder="e.g. Ramesh Patel"
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_ATTENDEE_AGE_OR_NAME',
                  id: primaryBooker.id,
                  fullName: e.target.value,
                })
              }
              className="w-full bg-white/5 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-gold"
            />
            {!isBookerNameValid && (
              <span className="text-[11px] text-error mt-1 block">
                Full name is required
              </span>
            )}
          </div>

          {/* Booker Age */}
          <div>
            <label
              htmlFor="primary-booker-age"
              className="block text-xs font-medium text-white/80 mb-1"
            >
              Primary Booker Age <span className="text-primary">*</span>
            </label>
            <input
              id="primary-booker-age"
              type="number"
              min={18}
              max={120}
              value={isNaN(primaryBooker.age) ? '' : primaryBooker.age}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                dispatch({
                  type: 'UPDATE_ATTENDEE_AGE_OR_NAME',
                  id: primaryBooker.id,
                  age: isNaN(val) ? 0 : val,
                });
              }}
              className={`w-full bg-white/5 border rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-gold ${
                !isBookerAgeValid ? 'border-error' : 'border-white/20'
              }`}
            />
            {!isBookerAgeValid && (
              <span className="text-[11px] text-error mt-1 block">
                Primary booker must be an adult aged 18 or above
              </span>
            )}
          </div>

          {/* Email Address */}
          <div>
            <label
              htmlFor="primary-booker-email"
              className="block text-xs font-medium text-white/80 mb-1"
            >
              Email Address (for passes & QR codes) <span className="text-primary">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
              <input
                id="primary-booker-email"
                type="email"
                value={primaryBooker.email || ''}
                placeholder="name@example.com"
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_ATTENDEE_CONTACT',
                    id: primaryBooker.id,
                    email: e.target.value,
                  })
                }
                className={`w-full bg-white/5 border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-gold ${
                  primaryBooker.email && !isEmailValid ? 'border-error' : 'border-white/20'
                }`}
              />
            </div>
            {primaryBooker.email && !isEmailValid && (
              <span className="text-[11px] text-error mt-1 block">
                Please enter a valid email address
              </span>
            )}
          </div>

          {/* Mobile Phone */}
          <div>
            <label
              htmlFor="primary-booker-phone"
              className="block text-xs font-medium text-white/80 mb-1"
            >
              Mobile Phone Number (SMS updates) <span className="text-primary">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
              <input
                id="primary-booker-phone"
                type="tel"
                value={primaryBooker.phone || ''}
                placeholder="+1 (555) 000-0000"
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_ATTENDEE_CONTACT',
                    id: primaryBooker.id,
                    phone: e.target.value,
                  })
                }
                className="w-full bg-white/5 border border-white/20 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-gold"
              />
            </div>
            {primaryBooker.phone && !isPhoneValid && (
              <span className="text-[11px] text-error mt-1 block">
                Phone number must have at least 7 digits
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Other Group Members (if more than 1) */}
      {state.attendees.length > 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold text-lg text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <span>Other Group Attendees ({state.attendees.length - 1})</span>
            </h3>
            <span className="text-xs text-white/50">
              For security check-in & gate wristbands
            </span>
          </div>

          <div className="space-y-3">
            {state.attendees
              .filter((a) => !a.isPrimaryBooker && a.id !== primaryBooker.id)
              .map((attendee, idx) => {
                const isUnder12 = attendee.age < 12;

                return (
                  <div
                    key={attendee.id}
                    className="card-dark p-4 border-white/10 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">
                        Attendee #{idx + 2} —{' '}
                        {attendee.age < 5
                          ? 'Toddler (Under 5)'
                          : attendee.age <= 11
                            ? 'Child (5–11)'
                            : 'Adult (12+)'}
                      </span>

                      {isUnder12 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 text-[11px]">
                          Guardian: {primaryBooker.fullName.trim() || 'Primary Booker'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor={`attendee-name-${attendee.id}`}
                          className="block text-xs font-medium text-white/70 mb-1"
                        >
                          Full Name <span className="text-primary">*</span>
                        </label>
                        <input
                          id={`attendee-name-${attendee.id}`}
                          type="text"
                          value={attendee.fullName}
                          placeholder="Attendee full name"
                          onChange={(e) =>
                            dispatch({
                              type: 'UPDATE_ATTENDEE_AGE_OR_NAME',
                              id: attendee.id,
                              fullName: e.target.value,
                            })
                          }
                          className="w-full bg-white/5 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-gold"
                        />
                      </div>

                      {!isUnder12 ? (
                        <div>
                          <label
                            htmlFor={`attendee-phone-${attendee.id}`}
                            className="block text-xs font-medium text-white/70 mb-1"
                          >
                            Mobile Phone <span className="text-white/40">(Optional)</span>
                          </label>
                          <input
                            id={`attendee-phone-${attendee.id}`}
                            type="tel"
                            value={attendee.phone || ''}
                            placeholder="Optional attendee phone"
                            onChange={(e) =>
                              dispatch({
                                type: 'UPDATE_ATTENDEE_CONTACT',
                                id: attendee.id,
                                phone: e.target.value,
                              })
                            }
                            className="w-full bg-white/5 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:border-gold"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center pt-5 text-xs text-white/50">
                          <span>Children do not need individual phone or email contact info.</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Validation Checklist / Guidance */}
      {!canProceed && (
        <div className="p-4 rounded-xl bg-gold/10 border border-gold/30 text-xs text-brightGold flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">Please complete required fields:</span>
            <ul className="list-disc list-inside space-y-0.5 text-white/80">
              {!isBookerNameValid && <li>Enter Primary Booker full name</li>}
              {!isBookerAgeValid && <li>Primary Booker age must be 18 or older</li>}
              {!isEmailValid && <li>Enter a valid email address</li>}
              {!isPhoneValid && <li>Enter a valid phone number (at least 7 digits)</li>}
              {!areAllAttendeeNamesProvided && <li>Provide names for all attendees</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <div className="pt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="btn-outline-gold inline-flex items-center gap-2 text-xs sm:text-sm"
        >
          <span>←</span>
          <span>Back to Extras</span>
        </button>

        <button
          type="button"
          disabled={!canProceed}
          onClick={onProceed}
          className="btn-gold inline-flex items-center gap-2"
        >
          <span>Review Order & Pay</span>
          <span>→</span>
        </button>
      </div>
    </div>
  );
}
