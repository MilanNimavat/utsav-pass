'use client';

import React from 'react';
import { Calendar, Check, MapPin, Sparkles } from 'lucide-react';
import type { FlowStep } from '@/state/booking-reducer';

interface BookingHeaderProps {
  currentStep: FlowStep;
  onNavigateStep: (step: FlowStep) => void;
}

const STEPS: { id: FlowStep; number: number; label: string; shortLabel: string }[] = [
  { id: 'GROUP_AND_PASSES', number: 1, label: 'Passes & Days', shortLabel: 'Passes' },
  { id: 'EXTRAS', number: 2, label: 'Festival Extras', shortLabel: 'Extras' },
  { id: 'ATTENDEE_DETAILS', number: 3, label: 'Attendee Details', shortLabel: 'Details' },
  { id: 'PAYMENT', number: 4, label: 'Review & Pay', shortLabel: 'Payment' },
];

export function BookingHeader({ currentStep, onNavigateStep }: BookingHeaderProps) {
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <header className="w-full border-b border-white/10 bg-primaryDark/95 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Festival Title Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 text-brightGold text-xs sm:text-sm font-semibold tracking-wider uppercase mb-1">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span>Radha Krishna Temple of Dallas • Allen, Texas</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight flex items-center gap-2">
              Sharad Utsav 2026
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-white/80">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/15 text-white/90">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Tue 10 Nov – Sat 14 Nov 2026</span>
            </span>
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/15 text-white/90">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>1450 N Watters Rd, Allen, TX</span>
            </span>
          </div>
        </div>

        {/* Step Progress Indicator (Hidden on CONFIRMED step) */}
        {currentStep !== 'CONFIRMED' && (
          <nav aria-label="Booking Progress" className="pt-4">
            <ol className="grid grid-cols-4 gap-2 sm:gap-4">
              {STEPS.map((step, idx) => {
                const isCompleted = currentStepIndex > idx;
                const isCurrent = currentStep === step.id;
                const isClickable = isCompleted || isCurrent;

                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      disabled={!isClickable}
                      onClick={() => onNavigateStep(step.id)}
                      className={`w-full text-left transition-all duration-200 group flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 p-2 sm:p-2.5 rounded-xl ${
                        isCurrent
                          ? 'bg-primary/15 border border-primary/40 shadow-sm'
                          : isCompleted
                            ? 'hover:bg-white/5 cursor-pointer'
                            : 'opacity-50 cursor-not-allowed'
                      }`}
                      aria-current={isCurrent ? 'step' : undefined}
                    >
                      <div
                        className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                          isCurrent
                            ? 'bg-primary text-primaryDark ring-2 ring-brightGold/50'
                            : isCompleted
                              ? 'bg-success text-white'
                              : 'bg-white/10 text-white/60'
                        }`}
                      >
                        {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.number}
                      </div>

                      <div className="min-w-0">
                        <span className="block text-[10px] uppercase font-semibold text-white/50 tracking-wider">
                          Step {step.number}
                        </span>
                        <span
                          className={`block text-xs sm:text-sm font-medium truncate ${
                            isCurrent
                              ? 'text-brightGold font-semibold'
                              : isCompleted
                                ? 'text-white'
                                : 'text-white/60'
                          }`}
                        >
                          <span className="sm:hidden">{step.shortLabel}</span>
                          <span className="hidden sm:inline">{step.label}</span>
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </div>
    </header>
  );
}
