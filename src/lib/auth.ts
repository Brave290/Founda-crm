"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

// ── Guest mode: use app without account, no memory stored ──

const GUEST_KEY = "founda_guest";
const GUEST_SESSIONS_KEY = "founda_guest_sessions";

export interface GuestSession {
  id: string;
  title: string;
  agent: string;
  messages: any[];
  createdAt: string;
}

export function isGuest(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(GUEST_KEY) === "true";
}

export function enterGuestMode() {
  localStorage.setItem(GUEST_KEY, "true");
}

export function exitGuestMode() {
  localStorage.removeItem(GUEST_KEY);
}

// Guest sessions (localStorage only, cleared when account created)
export function loadGuestSessions(): GuestSession[] {
  try {
    return JSON.parse(localStorage.getItem(GUEST_SESSIONS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveGuestSession(session: GuestSession) {
  const sessions = loadGuestSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) sessions[idx] = session;
  else sessions.unshift(session);
  // Keep only last 20 guest sessions
  localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify(sessions.slice(0, 20)));
}

export function deleteGuestSession(id: string) {
  const sessions = loadGuestSessions().filter((s) => s.id !== id);
  localStorage.setItem(GUEST_SESSIONS_KEY, JSON.stringify(sessions));
}

// ── Auth hook ──
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const finish = (u: any) => {
      if (!active) return;
      setUser(u);
      if (u) {
        setGuest(false);
        exitGuestMode();
      } else {
        setGuest(isGuest());
      }
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
    exitGuestMode();
    setGuest(false);
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
      exitGuestMode();
      setGuest(false);
      setUser(data.user);
    }
    return { needsConfirm: !data.session };
  };

  const logout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    setGuest(false);
  };

  const continueAsGuest = useCallback(() => {
    enterGuestMode();
    setGuest(true);
    setUser(null);
    setLoading(false);
  }, []);

  return { user, guest, loading, login, register, logout, continueAsGuest };
}
