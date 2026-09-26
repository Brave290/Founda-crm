"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircleIcon, XCircleIcon, InfoIcon } from "@/components/icons";
import {
  getStore,
  trackStoreUsage,
  resetStoreUsage,
  subscribe as subscribeStore,
  ensureInit,
} from "@/lib/store";
import { isGuest } from "@/lib/auth";

// ── Usage tracking (server-backed via lib/store, synced across devices) ──

const DAILY_LIMIT = 1_000_000; // messages per day (soft anti-abuse cap)
const TOKEN_LIMIT = 5_000_000_000; // 5 billion tokens per day — effectively unlimited for normal use

interface UsageState {
  messagesUsed: number;
  tokensUsed: number;
  dailyLimit: number;
  tokenLimit: number;
  resetAt: number; // timestamp of next reset
  conversations: number;
}

function getResetTime(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getTime();
}

let storeInitStarted = false;
function initStoreIfNeeded() {
  if (storeInitStarted || typeof window === "undefined") return;
  storeInitStarted = true;
  // hydrate from server (idempotent — useAuth usually wins the race)
  if (isGuest()) ensureInit("guest");
}

export function loadUsage(): UsageState {
  if (typeof window === "undefined") {
    return { messagesUsed: 0, tokensUsed: 0, dailyLimit: DAILY_LIMIT, tokenLimit: TOKEN_LIMIT, resetAt: 0, conversations: 0 };
  }
  initStoreIfNeeded();
  const u = getStore().usage;
  return {
    messagesUsed: u.messages,
    tokensUsed: u.tokens,
    dailyLimit: DAILY_LIMIT,
    tokenLimit: TOKEN_LIMIT,
    resetAt: getResetTime(),
    conversations: u.conversations,
  };
}

export function trackUsage(messages: number = 1, tokens: number = 0): UsageState {
  initStoreIfNeeded();
  trackStoreUsage(messages, tokens);
  return loadUsage();
}

export function resetUsage() {
  resetStoreUsage();
}

export function canSend(): boolean {
  const usage = loadUsage();
  return usage.messagesUsed < usage.dailyLimit;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n % 1_000_000_000 === 0 ? 0 : 1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ── Countdown hook ──
export function useCountdown(target: number) {
  const [timeLeft, setTimeLeft] = useState({ h: 0, m: 0, s: 0 });

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setTimeLeft({
        h: Math.floor(diff / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return timeLeft;
}

// ── Usage Panel Component ──
export function UsagePanel({ compact = false }: { compact?: boolean }) {
  const [usage, setUsage] = useState<UsageState | null>(null);
  const countdown = useCountdown(usage?.resetAt || Date.now());

  useEffect(() => {
    setUsage(loadUsage());
    const unsub = subscribeStore(() => setUsage(loadUsage()));
    const interval = setInterval(() => setUsage(loadUsage()), 5000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  if (!usage) return null;

  const msgPct = Math.min(100, (usage.messagesUsed / usage.dailyLimit) * 100);
  const tokPct = Math.min(100, (usage.tokensUsed / usage.tokenLimit) * 100);
  const isLow = msgPct > 80;
  const isCritical = msgPct > 95;

  if (compact) {
    return (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-3 py-1.5 flex items-center gap-2.5 text-xs backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <div className={`h-1.5 w-1.5 rounded-full ${isCritical ? "bg-red-400" : isLow ? "bg-amber-400" : "bg-emerald-400"}`} />
          <span className="text-slate-400 font-mono">{usage.messagesUsed}/{usage.dailyLimit}</span>
        </div>
        <div className="h-1 w-14 bg-white/10 rounded-full overflow-hidden hidden sm:block">
          <div className={`h-full rounded-full transition-all duration-500 ${isCritical ? "bg-red-500 progress-stripe" : isLow ? "bg-amber-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"}`}
            style={{ width: `${msgPct}%` }} />
        </div>
        <span className="text-slate-600 font-mono text-[11px]">
          {String(countdown.h).padStart(2, "0")}:{String(countdown.m).padStart(2, "0")}:{String(countdown.s).padStart(2, "0")}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#10141f]/95 backdrop-blur-xl p-5 animate-fade-up shadow-xl shadow-emerald-950/40">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm gradient-text">Usage</h3>
        <div className="text-[11px] text-emerald-300 font-mono bg-emerald-500/10 border border-emerald-500/25 px-2 py-1 rounded-md">
          resets {String(countdown.h).padStart(2, "0")}:{String(countdown.m).padStart(2, "0")}:{String(countdown.s).padStart(2, "0")}
        </div>
      </div>

      {/* Messages */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-500">Messages today</span>
          <span className={`font-mono ${isCritical ? "text-red-400" : isLow ? "text-amber-400" : "text-slate-300"}`}>
            {usage.messagesUsed} / {usage.dailyLimit}
          </span>
        </div>
        <div className="h-2 bg-white/[0.08] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${isCritical ? "bg-red-500 progress-stripe" : isLow ? "bg-amber-500" : "bg-gradient-to-r from-emerald-500 to-teal-500"}`}
            style={{ width: `${msgPct}%` }} />
        </div>
      </div>

      {/* Tokens */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-500">Tokens today</span>
          <span className="font-mono text-slate-300">
            {formatTokens(usage.tokensUsed)} / {formatTokens(usage.tokenLimit)}
          </span>
        </div>
        <div className="h-2 bg-white/[0.08] rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-400 transition-all duration-700"
            style={{ width: `${tokPct}%` }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] p-2">
          <div className="text-lg font-semibold text-emerald-300">{usage.messagesUsed}</div>
          <div className="text-[10px] text-slate-500">Sent</div>
        </div>
        <div className="rounded-lg border border-teal-500/20 bg-teal-500/[0.07] p-2">
          <div className="text-lg font-semibold text-amber-300">{usage.dailyLimit - usage.messagesUsed}</div>
          <div className="text-[10px] text-slate-500">Left</div>
        </div>
        <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.07] p-2">
          <div className="text-lg font-semibold text-sky-300">{usage.conversations}</div>
          <div className="text-[10px] text-slate-500">Chats</div>
        </div>
      </div>

      {isLow && (
        <div className={`mt-3 text-xs px-3 py-2 rounded-lg border ${isCritical ? "bg-red-500/[0.08] text-red-400 border-red-500/20" : "bg-amber-500/[0.08] text-amber-400 border-amber-500/20"}`}>
          {isCritical ? "Almost out of messages. Resets at midnight." : "Running low on messages today."}
        </div>
      )}
    </div>
  );
}

// ── Toast system ──
export function useToast() {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: string }[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const Toaster = () => (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-in rounded-xl px-4 py-3 text-sm flex items-center gap-3 shadow-2xl border bg-[#101a30]/95 backdrop-blur-xl ${
          t.type === "success" ? "border-emerald-500/25" : t.type === "error" ? "border-red-500/25" : "border-white/10"
        }`}>
          <span className={
            t.type === "success" ? "text-emerald-400" : t.type === "error" ? "text-red-400" : "text-slate-400"
          }>
            {t.type === "success" ? <CheckCircleIcon size={16} /> : t.type === "error" ? <XCircleIcon size={16} /> : <InfoIcon size={16} />}
          </span>
          <span className="text-slate-200">{t.message}</span>
        </div>
      ))}
    </div>
  );

  return { toast, Toaster };
}