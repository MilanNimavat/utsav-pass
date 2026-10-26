'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  Flame,
  Loader2,
  RefreshCw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { InventoryStock } from '@/domain/types';

interface EvaluatorToolsBarProps {
  stock: InventoryStock | null;
  onStockReset: () => Promise<void>;
}

export function EvaluatorToolsBar({ stock, onStockReset }: EvaluatorToolsBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleResetStock = async () => {
    setIsResetting(true);
    setResetMessage(null);

    try {
      const res = await fetch('/api/admin/reset-stock', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        await onStockReset();
        setResetMessage('Stock successfully reset to initial assessment values!');
        setTimeout(() => setResetMessage(null), 4000);
      } else {
        setResetMessage('Error resetting stock.');
      }
    } catch (err) {
      console.error('Reset stock error:', err);
      setResetMessage('Network error while resetting stock.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <aside aria-label="Evaluator Controls" className="w-full border-t border-gold/30 bg-primaryDark/95 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Toggle Button */}
        <div className="py-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-brightGold hover:text-white transition-colors"
          >
            <Wrench className="w-4 h-4 text-primary" />
            <span>Evaluator Tools & Live Stock Inspector</span>
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          <div className="flex items-center gap-3 text-[11px] text-white/60">
            {stock && (
              <span className="hidden sm:inline">
                Workshop Stock: <strong className="text-amber-300">{stock.GARBA_WORKSHOP} remaining</strong>
              </span>
            )}
            <button
              type="button"
              disabled={isResetting}
              onClick={handleResetStock}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/20 hover:bg-gold/30 text-brightGold border border-gold/40 text-xs font-semibold transition-all disabled:opacity-50"
            >
              {isResetting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              <span>Reset Stock</span>
            </button>
          </div>
        </div>

        {/* Collapsible Inspector Drawer */}
        {isOpen && (
          <div className="py-4 border-t border-white/10 space-y-4 text-xs">
            {resetMessage && (
              <div className="p-2.5 rounded-xl bg-success/20 border border-success/40 text-success font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{resetMessage}</span>
              </div>
            )}

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 block mb-2">
                Live Server Inventory Table (Authoritative PostgreSQL / SQLite state):
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-white/60 block text-[10px]">Adult Day Pass</span>
                  <span className="font-bold text-white text-sm">{stock?.DAY_ADULT ?? '...'}</span>
                  <span className="text-[10px] text-white/40 block">($15.00/day)</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-white/60 block text-[10px]">Child Day Pass</span>
                  <span className="font-bold text-white text-sm">{stock?.DAY_CHILD ?? '...'}</span>
                  <span className="text-[10px] text-white/40 block">($8.00/day)</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-error/30 bg-error/[0.05]">
                  <span className="text-error block text-[10px] font-semibold">Adult All-Day Pass</span>
                  <span className="font-bold text-error text-sm">{stock?.ALL_DAY_ADULT ?? 0}</span>
                  <span className="text-[10px] text-error/60 block">(Sold Out)</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-white/60 block text-[10px]">Child All-Day Pass</span>
                  <span className="font-bold text-white text-sm">{stock?.ALL_DAY_CHILD ?? '...'}</span>
                  <span className="text-[10px] text-white/40 block">($30.00 flat)</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-white/60 block text-[10px]">Family Pass ($40)</span>
                  <span className="font-bold text-white text-sm">{stock?.FAMILY_PASS ?? '...'}</span>
                  <span className="text-[10px] text-white/40 block">(2 Ad + 2 Ch)</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-white/60 block text-[10px]">Dandiya Sticks</span>
                  <span className="font-bold text-white text-sm">{stock?.DANDIYA_STICKS ?? '...'}</span>
                  <span className="text-[10px] text-white/40 block">($5.00/pair)</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-white/60 block text-[10px]">Dinner Plates</span>
                  <span className="font-bold text-white text-sm">{stock?.DINNER_PLATE ?? '...'}</span>
                  <span className="text-[10px] text-white/40 block">($12.00/person)</span>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40">
                  <span className="text-amber-300 block text-[10px] font-semibold flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>Garba Workshop</span>
                  </span>
                  <span className="font-bold text-amber-300 text-sm">
                    {stock?.GARBA_WORKSHOP ?? 0} remaining
                  </span>
                  <span className="text-[10px] text-amber-300/70 block">(Nov 11 & 13)</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-[11px] text-white/60">
              <p>
                💡 <em>Evaluator Note:</em> The button above resets the server database atomically. Use this to repeatedly test the 2-seat limit on the Garba Workshop, concurrent race conditions, and out-of-stock recovery.
              </p>

              <button
                type="button"
                disabled={isResetting}
                onClick={handleResetStock}
                className="btn-gold text-xs py-2 px-4 shrink-0"
              >
                Reset Database to Initial Stock
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
