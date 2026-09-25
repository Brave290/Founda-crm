"use client";

// ── Server-backed store (single source of truth) ──
// Reads are synchronous from an in-memory cache; the cache hydrates from
// /api/store on init and writes back (debounced) on every mutation.
// localStorage is only used for: the device id, the guest flag, and a
// one-time legacy migration seed.

export interface GuestSession {
  id: string;
  title: string;
  agent: string;
  messages: any[];
  createdAt: string;
}

export interface StoreData {
  sessions: GuestSession[];
  settings: {
    apiKeys: Record<string, string>;
    prefs: Record<string, any>;
  };
  usage: {
    day: string;
    messages: number;
    tokens: number;
    conversations: number;
  };
}

export type StoreMode = "guest" | "account" | null;

const DEVICE_KEY = "founda_device";
const LEGACY_SESSIONS_KEY = "founda_guest_sessions";
const LEGACY_USAGE_KEY = "founda_usage";

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultData(): StoreData {
  return {
    sessions: [],
    settings: { apiKeys: {}, prefs: {} },
    usage: { day: today(), messages: 0, tokens: 0, conversations: 0 },
  };
}

let cache: StoreData = defaultData();
let mode: StoreMode = null;
let userId: string | null = null;
let initPromise: Promise<void> | null = null;
let hydrated = false;
let mutatedDuringInit = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;
const listeners = new Set<() => void>();

// ── Identity ──
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

// ── Events ──
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((f) => f());
}

export function getStore(): StoreData {
  return cache;
}

export function isStoreReady(): boolean {
  return initPromise !== null && mode !== null;
}

function normalize(d: any): StoreData {
  const base = defaultData();
  if (!d || typeof d !== "object") return base;
  const usage = { ...base.usage, ...(d.usage || {}) };
  if (usage.day !== today()) {
    usage.day = today();
    usage.messages = 0;
    usage.tokens = 0;
  }
  return {
    sessions: Array.isArray(d.sessions) ? d.sessions : [],
    settings: {
      apiKeys: { ...(d.settings?.apiKeys || {}) },
      prefs: { ...(d.settings?.prefs || {}) },
    },
    usage,
  };
}

function readLegacy(): StoreData {
  const out = defaultData();
  try {
    const raw = localStorage.getItem(LEGACY_SESSIONS_KEY);
    if (raw) out.sessions = JSON.parse(raw) || [];
  } catch {}
  try {
    const raw = localStorage.getItem(LEGACY_USAGE_KEY);
    if (raw) {
      const u = JSON.parse(raw);
      if (u && (!u.resetAt || Date.now() < u.resetAt)) {
        out.usage = {
          day: today(),
          messages: u.messagesUsed || 0,
          tokens: u.tokensUsed || 0,
          conversations: u.conversations || 0,
        };
      }
    }
  } catch {}
  return out;
}

function merge(legacy: StoreData, server: StoreData): StoreData {
  // server wins where it has data; legacy seeds an empty server (first run / new device)
  const sessions = server.sessions.length > 0 ? server.sessions : legacy.sessions;
  const apiKeys = { ...legacy.settings.apiKeys, ...server.settings.apiKeys };
  const prefs = { ...legacy.settings.prefs, ...server.settings.prefs };
  const usage =
    server.usage.messages > 0 || server.usage.tokens > 0
      ? server.usage
      : legacy.usage;
  return {
    sessions,
    settings: { apiKeys, prefs },
    usage,
  };
}

function capPayload() {
  // keep guest jsonb under the API limit: newest 20 sessions, 100 msgs each, 20k chars per msg
  cache.sessions = cache.sessions.slice(0, 20).map((s) => {
    const msgs = (s.messages || []).slice(-100).map((m: any) =>
      typeof m?.content === "string" && m.content.length > 20000
        ? { ...m, content: m.content.slice(0, 20000) + "…" }
        : m
    );
    return { ...s, messages: msgs };
  });
  let size = JSON.stringify(cache).length;
  if (size > 1_300_000) {
    cache.sessions = cache.sessions.slice(0, 8);
    size = JSON.stringify(cache).length;
    if (size > 1_300_000) {
      cache.sessions = cache.sessions.slice(0, 3).map((s) => ({
        ...s,
        messages: (s.messages || []).slice(-30),
      }));
    }
  }
}

async function pushServer(): Promise<boolean> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (mode !== "account") headers["x-device-id"] = getDeviceId();
    const res = await fetch("/api/store", {
      method: "PUT",
      headers,
      body: JSON.stringify({ data: cache }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function flush(immediate = false) {
  if (mode === null) return;
  dirty = true;
  if (flushTimer) clearTimeout(flushTimer);
  const run = async () => {
    if (!dirty) return;
    dirty = false;
    capPayload();
    await pushServer();
  };
  if (immediate) run();
  else flushTimer = setTimeout(run, 400);
}

function mutate(fn: (d: StoreData) => void) {
  fn(cache);
  if (!hydrated) mutatedDuringInit = true;
  emit();
  flush();
}

// ── Init / hydration ──
export function ensureInit(newMode: "guest" | "account", uid?: string | null): Promise<void> {
  if (mode === newMode && (newMode === "guest" || uid === userId) && initPromise) {
    return initPromise;
  }
  mode = newMode;
  userId = uid || null;
  initPromise = (async () => {
    let server: StoreData | null = null;
    try {
      if (newMode === "account" && uid) {
        const { createSupabaseBrowserClient } = await import("./supabase-browser");
        const supa = createSupabaseBrowserClient();
        const { data } = await supa
          .from("profiles")
          .select("settings")
          .eq("id", uid)
          .maybeSingle();
        if (data?.settings) server = normalize(data.settings);
      } else {
        const headers: Record<string, string> = { "x-device-id": getDeviceId() };
        const res = await fetch("/api/store", { headers });
        if (res.ok) {
          const body = await res.json();
          if (body?.data) server = normalize(body.data);
        }
      }
    } catch {}

    const legacy = mutatedDuringInit ? cache : readLegacy();
    cache = merge(legacy, server || defaultData());

    const serverEmpty =
      !server || (server.sessions.length === 0 && Object.keys(server.settings.apiKeys).length === 0);
    if (!mutatedDuringInit && serverEmpty && (legacy.sessions.length > 0 || legacy.usage.messages > 0)) {
      flush(true); // one-time migration of pre-server data
    }
    if (mutatedDuringInit || dirty) flush(true); // don't lose edits made while hydrating
    // clear legacy keys so migration can't double-count later
    try {
      localStorage.removeItem(LEGACY_SESSIONS_KEY);
      localStorage.removeItem(LEGACY_USAGE_KEY);
    } catch {}
    hydrated = true;
    emit();
  })();
  return initPromise;
}

export async function ready(): Promise<void> {
  if (initPromise) await initPromise;
}

// ── Sessions (guest device storage) ──
export function loadStoreSessions(): GuestSession[] {
  return cache.sessions;
}

export function saveStoreSession(session: GuestSession) {
  mutate((d) => {
    const idx = d.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) d.sessions[idx] = session;
    else d.sessions.unshift(session);
    d.sessions = d.sessions.slice(0, 20);
    d.usage.conversations = Math.max(d.usage.conversations, d.sessions.length);
  });
}

export function deleteStoreSession(id: string) {
  mutate((d) => {
    d.sessions = d.sessions.filter((s) => s.id !== id);
  });
}

// ── Settings ──
export function getApiKeys(): Record<string, string> {
  return cache.settings.apiKeys;
}

export function getPrefs(): Record<string, any> {
  return cache.settings.prefs;
}

export function saveApiKey(provider: string, key: string) {
  mutate((d) => {
    if (key) d.settings.apiKeys[provider] = key;
    else delete d.settings.apiKeys[provider];
  });
}

export function savePrefs(prefs: Record<string, any>) {
  mutate((d) => {
    d.settings.prefs = { ...d.settings.prefs, ...prefs };
  });
}

// ── Usage ──
export function trackStoreUsage(messages = 1, tokens = 0) {
  mutate((d) => {
    if (d.usage.day !== today()) {
      d.usage.day = today();
      d.usage.messages = 0;
      d.usage.tokens = 0;
    }
    if (messages === 0 && tokens === 0) d.usage.conversations += 1;
    d.usage.messages += messages;
    d.usage.tokens += tokens;
  });
  return cache.usage;
}

export function resetStoreUsage() {
  mutate((d) => {
    d.usage = { day: today(), messages: 0, tokens: 0, conversations: d.usage.conversations };
  });
}

export function clearAllStoreData() {
  cache = defaultData();
  emit();
  flush(true);
}

// ── Claim guest data into a new/existing account ──
let claimed = false;
export async function claimGuestToAccount(uid: string) {
  if (claimed) return;
  claimed = true;
  const guestSessions = cache.sessions.slice();
  if (guestSessions.length === 0) return;
  try {
    const { createSupabaseBrowserClient } = await import("./supabase-browser");
    const supa = createSupabaseBrowserClient();
    for (const s of guestSessions) {
      await supa.from("sessions").insert({
        user_id: uid,
        title: s.title || "New chat",
        agent_name: s.agent || "build",
        state: { messages: s.messages || [] },
        message_count: s.messages?.length || 0,
      });
    }
    mutate((d) => {
      d.sessions = [];
    });
  } catch {}
}
