"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ensureInit } from "@/lib/store";

// Account-backed workspaces only: every signed-in user gets a server-side
// profile store (sessions, keys, usage, prefs) that syncs across devices.

// ── Auth hook ──
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const finish = (u: any) => {
      if (!active) return;
      setUser(u);
      if (u) ensureInit(u.id);
      setLoading(false);
    };

    let supabase: ReturnType<typeof createSupabaseBrowserClient>;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      finish(null);
      return () => {
        active = false;
      };
    }

    // Never hang on the spinner — resolve even if the network fails
    const timeout = setTimeout(() => finish(null), 5000);

    supabase.auth
      .getUser()
      .then(({ data: { user } }) => finish(user))
      .catch(() => finish(null));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      clearTimeout(timeout);
      finish(session?.user || null);
    });

    return () => {
      active = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const register = async (email: string, password: string, name: string) => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) return { error: error.message };
    if (data.session) {
      setUser(data.user);
      ensureInit(data.user?.id || null);
    }
    return { needsConfirm: !data.session };
  };

  const logout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
  };

  return { user, loading, login, register, logout };
}
