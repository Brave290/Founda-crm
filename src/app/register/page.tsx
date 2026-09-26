"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { AuthShell, AuthTabs, AuthField } from "@/components/auth-shell";
import { MailIcon, LockIcon, CheckCircleIcon } from "@/components/icons";

export default function RegisterPage() {
  const router = useRouter();
  const { register, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !authLoading && user) router.replace(`/sessions/${crypto.randomUUID()}`);
  }, [mounted, authLoading, user]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error, needsConfirm } = await register(email, password, fullName);
    if (error) { setError(error); setLoading(false); return; }
    if (needsConfirm) { setNeedsConfirm(true); setLoading(false); return; }
    router.push(`/sessions/${crypto.randomUUID()}`);
    router.refresh();
  };


  if (needsConfirm) {
    return (
      <AuthShell title="Check your email" subtitle="One click to activate your account">
        <div className="text-center py-2 animate-scale-in">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-5 text-white shadow-lg shadow-teal-500/30">
            <MailIcon size={24} />
          </div>
          <p className="text-slate-400 text-sm mb-7 leading-relaxed">
            We sent a confirmation link to
            <br />
            <strong className="text-white">{email}</strong>
            <br />
            Click it to activate your account.
          </p>
          <Link
            href="/login"
            className="glass-btn-primary inline-block px-6 py-3 rounded-xl text-sm font-medium"
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your workspace" subtitle="Free, persistent, no credit card">
      <AuthTabs active="register" />

      <form onSubmit={handleRegister} className="space-y-3">
        <div className="animate-fade-up stagger-1">
          <AuthField
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
          />
        </div>
        <div className="animate-fade-up stagger-2">
          <AuthField
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            autoComplete="email"
            icon={<MailIcon size={15} />}
          />
        </div>
        <div className="animate-fade-up stagger-3">
          <AuthField
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="Min 8 characters"
            autoComplete="new-password"
            icon={<LockIcon size={15} />}
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
          className="glass-btn-primary w-full py-3 rounded-xl text-sm font-medium animate-fade-up stagger-4 group flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating account…
            </span>
          ) : (
            <>
              Create account
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="transition-transform group-hover:translate-x-0.5">
                <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          )}
        </button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-white/[0.08]" />
        <span className="text-[11px] text-slate-600">or</span>
        <div className="flex-1 h-px bg-white/[0.08]" />
      </div>

      <button
        onClick={handleGuest}
        className="w-full py-3 rounded-xl text-sm text-slate-400 hover:text-white border border-white/10 hover:bg-white/[0.05] hover:border-white/25 transition-all animate-fade-up stagger-5"
      >
        Try without account
      </button>

      <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-slate-600">
        <span className="flex items-center gap-1 text-emerald-500/90">
          <CheckCircleIcon size={11} /> No email confirmation
        </span>
        <span className="flex items-center gap-1 text-emerald-500/90">
          <CheckCircleIcon size={11} /> Free forever
        </span>
      </div>

      <p className="text-center text-[13px] text-slate-500 mt-6 animate-fade-up stagger-6">
        Already have an account?{" "}
        <Link href="/login" className="text-emerald-300 hover:text-emerald-200 font-medium">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
