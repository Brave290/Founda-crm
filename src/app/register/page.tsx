"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { MailIcon, CheckCircleIcon } from "@/components/icons";

export default function RegisterPage() {
  const router = useRouter();
  const { register, continueAsGuest, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !authLoading && user) router.replace("/dashboard");
  }, [mounted, authLoading, user]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error, needsConfirm } = await register(email, password, fullName);
    if (error) { setError(error); setLoading(false); return; }
    if (needsConfirm) { setNeedsConfirm(true); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  };

  const handleGuest = () => {
    continueAsGuest();
    router.push("/dashboard");
  };

  if (needsConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        <div className="w-full max-w-sm relative z-10 text-center animate-scale-in">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl shadow-2xl shadow-emerald-950/50">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-teal-500/30">
              <MailIcon size={22} />
            </div>
            <h1 className="font-display text-xl font-semibold mb-2 text-white">Check your email</h1>
            <p className="text-slate-500 text-sm mb-6">
              We sent a confirmation link to <strong className="text-white">{email}</strong>.
              Click it to activate your account.
            </p>
            <Link href="/login" className="glass-btn-primary inline-block px-5 py-2.5 rounded-xl text-sm">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="w-full max-w-sm relative z-10 animate-scale-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <span className="font-semibold text-lg gradient-text tracking-tight">Founda</span>
            <span className="text-sm text-slate-600">CRM</span>
          </Link>
          <h1 className="font-display text-2xl font-semibold mb-1.5 text-white">Create account</h1>
          <p className="text-slate-500 text-sm">Persistent memory for your AI sessions</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl shadow-2xl shadow-emerald-950/50">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="animate-fade-up stagger-1">
              <label className="block text-[13px] text-slate-400 mb-1.5">Full name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="glass-input w-full px-3.5 py-2.5 rounded-xl text-white placeholder-slate-600 text-sm"
                placeholder="Your name"
              />
            </div>
            <div className="animate-fade-up stagger-2">
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
            <div className="animate-fade-up stagger-3">
              <label className="block text-[13px] text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="glass-input w-full px-3.5 py-2.5 rounded-xl text-white placeholder-slate-600 text-sm"
                placeholder="Min 8 characters"
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
              className="glass-btn-primary w-full py-2.5 rounded-xl text-sm animate-fade-up stagger-4"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/[0.08]" />
            <span className="text-[11px] text-slate-600">or</span>
            <div className="flex-1 h-px bg-white/[0.08]" />
          </div>

          <button onClick={handleGuest}
            className="w-full py-2.5 rounded-xl text-sm text-slate-400 hover:text-white border border-white/10 hover:bg-emerald-500/[0.1] hover:border-emerald-400/40 transition-all animate-fade-up stagger-5">
            Try without account
          </button>

          <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-slate-600">
            <span className="flex items-center gap-1 text-emerald-500/90"><CheckCircleIcon size={11} /> No email confirmation</span>
            <span className="flex items-center gap-1 text-emerald-500/90"><CheckCircleIcon size={11} /> Free forever</span>
          </div>
        </div>

        <p className="text-center text-[13px] text-slate-500 mt-5 animate-fade-up stagger-6">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-300 hover:text-emerald-200 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
