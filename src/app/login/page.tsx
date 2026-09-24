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
    if (mounted && !authLoading && (user || guest)) router.replace("/dashboard");
  }, [mounted, authLoading, user, guest]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await login(email, password);
    if (error) { setError(error); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  };

  const handleGuest = () => {
    continueAsGuest();
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 group">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-lg shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/50 transition-shadow">
              F
            </div>
            <span className="font-semibold text-lg">Founda CRM</span>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-gray-400">Sign in to your persistent AI workspace</p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="animate-fade-up stagger-1">
              <label className="block text-sm text-gray-300 mb-1.5 font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="glass-input w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div className="animate-fade-up stagger-2">
              <label className="block text-sm text-gray-300 mb-1.5 font-medium">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="glass-input w-full px-4 py-3 rounded-xl text-white placeholder-gray-500 text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="glass-btn-primary w-full py-3.5 rounded-xl font-medium text-white text-sm animate-fade-up stagger-3"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-xs text-gray-500">or</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          <button onClick={handleGuest}
            className="glass-btn w-full py-3.5 rounded-xl font-medium text-gray-300 text-sm hover:text-white animate-fade-up stagger-4">
            👻 Continue as Guest
          </button>
          <p className="text-[11px] text-gray-600 text-center mt-2">
            Guest mode: no account needed, but chats are not saved permanently.
          </p>
        </div>

        <p className="text-center text-sm text-gray-400 mt-6 animate-fade-up stagger-5">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}