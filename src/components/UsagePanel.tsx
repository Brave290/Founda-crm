"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Usage tracking (localStorage for guests, Supabase for logged in) ──

const DAILY_LIMIT = 50; // messages per day
const TOKEN_LIMIT = 50000; // tokens per day

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

export function loadUsage(): UsageState {
  if (typeof window === "undefined") {
    return { messagesUsed: 0, tokensUsed: 0, dailyLimit: DAILY_LIMIT, tokenLimit: TOKEN_LIMIT, resetAt: 0, conversations: 0 };
  }
  try {
    const raw = localStorage.getItem("founda_usage");
    if (raw) {
      const data = JSON.parse(raw);
      // Reset if past reset time
      if (Date.now() > data.resetAt) {
        return { messagesUsed: 0, tokensUsed: 0, dailyLimit: DAILY_LIMIT, tokenLimit: TOKEN_LIMIT, resetAt: getResetTime(), conversations: data.conversations || 0 };
      }
      return { ...data, dailyLimit: DAILY_LIMIT, tokenLimit: TOKEN_LIMIT };
    }
  } catch {}
  return { messagesUsed: 0, tokensUsed: 0, dailyLimit: DAILY_LIMIT, tokenLimit: TOKEN_LIMIT, resetAt: getResetTime(), conversations: 0 };
}

export function saveUsage(usage: UsageState) {
  if (typeof window === "undefined") return;
  localStorage.setItem("founda_usage", JSON.stringify(usage));
}

export function trackUsage(messages: number = 1, tokens: number = 0): UsageState {
  const usage = loadUsage();
  usage.messagesUsed += messages;
  usage.tokensUsed += tokens;
  if (messages > 0) usage.conversations = usage.conversations;
  saveUsage(usage);
  return usage;
}

export function resetUsage() {
  const usage = loadUsage();
  const fresh = { messagesUsed: 0, tokensUsed: 0, dailyLimit: DAILY_LIMIT, tokenLimit: TOKEN_LIMIT, resetAt: getResetTime(), conversations: usage.conversations };
  saveUsage(fresh);
  return fresh;
}

export function canSend(): boolean {
  const usage = loadUsage();
  return usage.messagesUsed < usage.dailyLimit;
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
    const interval = setInterval(() => setUsage(loadUsage()), 5000);
    return () => clearInterval(interval);
  }, []);

  if (!usage) return null;

  const msgPct = Math.min(100, (usage.messagesUsed / usage.dailyLimit) * 100);
  const tokPct = Math.min(100, (usage.tokensUsed / usage.tokenLimit) * 100);
  const isLow = msgPct > 80;
  const isCritical = msgPct > 95;

  if (compact) {
    return (
      <div className="glass rounded-xl px-3 py-2 flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${isCritical ? "bg-red-400" : isLow ? "bg-yellow-400" : "bg-emerald-400"}`} />
          <span className="text-gray-400">{usage.messagesUsed}/{usage.dailyLimit}</span>
        </div>
        <div className="h-1 w-16 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${isCritical ? "bg-red-500" : isLow ? "bg-yellow-500" : "bg-gradient-to-r from-indigo-500 to-cyan-400"}`}
            style={{ width: `${msgPct}%` }} />
        </div>
        <span className="text-gray-500 font-mono">
          {String(countdown.h).padStart(2, "0")}:{String(countdown.m).padStart(2, "0")}:{String(countdown.s).padStart(2, "0")}
        </span>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span className="text-lg">⚡</span> Usage
        </h3>
        <div className="text-xs text-gray-500 font-mono bg-gray-800/50 px-2 py-1 rounded-lg">
          resets in {String(countdown.h).padStart(2, "0")}:{String(countdown.m).padStart(2, "0")}:{String(countdown.s).padStart(2, "0")}
        </div>
      </div>

      {/* Messages */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-400">Messages today</span>
          <span className={`font-mono ${isCritical ? "text-red-400" : isLow ? "text-yellow-400" : "text-gray-300"}`}>
            {usage.messagesUsed} / {usage.dailyLimit}
          </span>
        </div>
        <div className="h-2.5 bg-gray-800/80 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${isCritical ? "bg-gradient-to-r from-red-500 to-red-400 progress-stripe" : isLow ? "bg-gradient-to-r from-yellow-500 to-orange-400" : "bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400"}`}
            style={{ width: `${msgPct}%` }} />
        </div>
      </div>

      {/* Tokens */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-400">Tokens today</span>
          <span className="font-mono text-gray-300">
            {(usage.tokensUsed / 1000).toFixed(1)}k / {(usage.tokenLimit / 1000).toFixed(0)}k
          </span>
        </div>
        <div className="h-2.5 bg-gray-800/80 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-700"
            style={{ width: `${tokPct}%` }} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="glass rounded-lg p-2">
          <div className="text-lg font-bold text-indigo-400">{usage.messagesUsed}</div>
          <div className="text-[10px] text-gray-500">Sent</div>
        </div>
        <div className="glass rounded-lg p-2">
          <div className="text-lg font-bold text-cyan-400">{usage.dailyLimit - usage.messagesUsed}</div>
          <div className="text-[10px] text-gray-500">Left</div>
        </div>
        <div className="glass rounded-lg p-2">
          <div className="text-lg font-bold text-emerald-400">{usage.conversations}</div>
          <div className="text-[10px] text-gray-500">Chats</div>
        </div>
      </div>

      {isLow && (
        <div className={`mt-3 text-xs px-3 py-2 rounded-lg ${isCritical ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"}`}>
          ⚠️ {isCritical ? "Almost out of messages! Resets at midnight." : "Running low on messages today."}
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
        <div key={t.id} className={`toast-in glass-strong rounded-xl px-4 py-3 text-sm flex items-center gap-3 shadow-2xl ${
          t.type === "success" ? "border-emerald-500/30" : t.type === "error" ? "border-red-500/30" : "border-indigo-500/30"
        }`}>
          <span>{t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}</span>
          <span className="text-gray-200">{t.message}</span>
        </div>
      ))}
    </div>
  );

  return { toast, Toaster };
}