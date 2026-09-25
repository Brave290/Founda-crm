"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { login, continueAsGuest, user, guest, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !authLoading && (user || guest)) router.replace(`/sessions/${crypto.randomUUID()}`);
  }, [mounted, authLoading, user, guest]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await login(email, password);
    if (error) { setError(error); setLoading(false); return; }
    router.push(`/sessions/${crypto.randomUUID()}`);
    router.refresh();
  };

  const handleGuest = () => {
    continueAsGuest();
    router.push(`/sessions/${crypto.randomUUID()}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="w-full max-w-sm relative z-10 animate-scale-in">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="font-semibold text-lg gradient-text tracking-tight">Founda</span>
            <span className="text-sm text-slate-600">CRM</span>
          </Link>
          <h1 className="font-display text-2xl font-semibold mb-1.5 text-white">Welcome back</h1>
          <p className="text-slate-500 text-sm">Sign in to your persistent AI workspace</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl shadow-2xl shadow-emerald-950/50">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="animate-fade-up stagger-1">
              <label className="block text-[13px] text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="glass-input w-full px-3.5 py-2.5 rounded-xl text-white placeholder-slate-600 text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div className="animate-fade-up stagger-2">
              <label className="block text-[13px] text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="glass-input w-full px-3.5 py-2.5 rounded-xl text-white placeholder-slate-600 text-sm"
                placeholder="Your password"
              />
            </div>

            {error && (
              <div className="text-red-400 text-[13px] bg-red-500/[0.08] border border-red-500/20 rounded-xl px-3.5 py-2.5 animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="glass-btn-primary w-full py-2.5 rounded-xl text-sm animate-fade-up stagger-3"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-[11px] text-slate-600">or</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          <button onClick={handleGuest}
            className="w-full py-2.5 rounded-xl text-sm text-slate-400 hover:text-white border border-white/10 hover:bg-emerald-500/[0.1] hover:border-emerald-400/40 transition-all animate-fade-up stagger-4">
            Continue as guest
          </button>
          <p className="text-[11px] text-slate-700 text-center mt-2.5">
            Guest mode: no account needed, but chats are not saved permanently.
          </p>
        </div>

        <p className="text-center text-[13px] text-slate-500 mt-5 animate-fade-up stagger-5">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-emerald-300 hover:text-emerald-200 font-medium">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}
