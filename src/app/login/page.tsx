"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { AuthShell, AuthTabs, AuthField } from "@/components/auth-shell";
import { MailIcon, LockIcon } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !authLoading && user) router.replace(`/sessions/${crypto.randomUUID()}`);
  }, [mounted, authLoading, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await login(email, password);
    if (error) { setError(error); setLoading(false); return; }
    router.push(`/sessions/${crypto.randomUUID()}`);
    router.refresh();
  };


  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your persistent AI workspace">
      <AuthTabs active="login" />

      <form onSubmit={handleLogin} className="space-y-3">
        <div className="animate-fade-up stagger-1">
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
        <div className="animate-fade-up stagger-2">
          <AuthField
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Your password"
            autoComplete="current-password"
            icon={<LockIcon size={15} />}
          />
        </div>

        <div className="flex justify-end">
          <button type="button" className="text-[12px] text-slate-600 hover:text-emerald-300 transition-colors">
            Forgot password?
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-[13px] bg-red-500/[0.08] border border-red-500/20 rounded-xl px-3.5 py-2.5 animate-fade-in">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="glass-btn-primary w-full py-3 rounded-xl text-sm font-medium animate-fade-up stagger-3 group flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Signing in…
            </span>
          ) : (
            <>
              Sign in
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
        className="w-full py-3 rounded-xl text-sm text-slate-400 hover:text-white border border-white/10 hover:bg-white/[0.05] hover:border-white/25 transition-all animate-fade-up stagger-4"
      >
        Continue as guest
      </button>
      <p className="text-[11px] text-slate-700 text-center mt-3 leading-relaxed">
        Guest chats stay on this device and are not saved permanently.
      </p>

      <p className="text-center text-[13px] text-slate-500 mt-6 animate-fade-up stagger-5">
        New here?{" "}
        <Link href="/register" className="text-emerald-300 hover:text-emerald-200 font-medium">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
