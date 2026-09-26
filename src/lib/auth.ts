"use client";

import { useState, useEffect, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  ensureInit,
  loadStoreSessions,
  saveStoreSession,
  deleteStoreSession,
  claimGuestToAccount,
  type GuestSession,
} from "@/lib/store";

// ── Guest mode: use app without account (data stored server-side per device) ──

const GUEST_KEY = "founda_guest";

export type { GuestSession };

// Guest flag is mirrored into a long-lived cookie so a wiped localStorage
// still resolves to the same server-side guest store (usage, sessions, keys).
function guestCookie(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)founda_guest=true(?:;|$)/.test(document.cookie);
}

export function isGuest(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(GUEST_KEY) === "true") {
      if (!guestCookie()) {
        document.cookie = "founda_guest=true;path=/;max-age=31536000;SameSite=Lax";
      }
      return true;
    }
  } catch {}
  return guestCookie();
}

export function enterGuestMode() {
  try { localStorage.setItem(GUEST_KEY, "true"); } catch {}
  document.cookie = "founda_guest=true;path=/;max-age=31536000;SameSite=Lax";
}

export function exitGuestMode() {
  try { localStorage.removeItem(GUEST_KEY); } catch {}
  document.cookie = "founda_guest=;path=/;max-age=0";
}

// Guest sessions (server-backed cache — same API as before, now persists)
export function loadGuestSessions(): GuestSession[] {
  return loadStoreSessions();
}

export function saveGuestSession(session: GuestSession) {
  saveStoreSession(session);
}

export function deleteGuestSession(id: string) {
  deleteStoreSession(id);
}

// ── Auth hook ──
export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [guest, setGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let wasGuest = isGuest();

    const finish = (u: any) => {
      if (!active) return;
      setUser(u);
      if (u) {
        // guest store may have been entered while the session was resolving
        const hadGuest = wasGuest || isGuest();
        setGuest(false);
        exitGuestMode();
        ensureInit("account", u.id);
        if (hadGuest) claimGuestToAccount(u.id);
      } else {
        // Anonymous visitors ALWAYS run in guest mode. Without this the store
        // stays uninitialized (mode === null) and every session/usage write is
        // silently dropped — empty sidebar, usage stuck at 0.
        if (!isGuest()) enterGuestMode();
        setGuest(true);
        ensureInit("guest");
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
      ensureInit("account", data.user?.id);
      claimGuestToAccount(data.user?.id || "");
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
    ensureInit("guest");
  }, []);

  return { user, guest, loading, login, register, logout, continueAsGuest };
}
