"use client";

// ── Server-backed store (single source of truth) ──
// Reads are synchronous from an in-memory cache; the cache hydrates from
// /api/store on init and writes back (debounced) on every mutation.
// localStorage is only used for: the device id (background-run identity
// fallback) and nothing else — the server is authoritative for all data.

export interface StoreData {
  sessions: any[];
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

const DEVICE_KEY = "founda_device";

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
let userId: string | null = null;
let initPromise: Promise<void> | null = null;
let hydrated = false;
let mutatedDuringInit = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;
const listeners = new Set<() => void>();

// ── Identity ──
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = "";
  try { id = localStorage.getItem(DEVICE_KEY) || ""; } catch {}
  if (!UUID_RE.test(id)) id = crypto.randomUUID();
  try { localStorage.setItem(DEVICE_KEY, id); } catch {}
  return id;
}

// ── Events ──
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // Late subscribers (sidebar, usage panel) often attach AFTER hydration has
  // already emitted — replay immediately so they don't render stale-empty.
  if (hydrated) fn();
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((f) => f());
}

export function getStore(): StoreData {
  return cache;
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

function capPayload() {
  // keep the profile jsonb row under the API limit: newest 20 sessions, 100 msgs each, 20k chars per msg
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
    const res = await fetch("/api/store", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: cache }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function flush(immediate = false) {
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
export function ensureInit(uid: string | null): Promise<void> {
  if (userId === uid && initPromise) return initPromise;
  userId = uid || null;
  initPromise = (async () => {
    let server: StoreData | null = null;
    try {
      const { createSupabaseBrowserClient } = await import("./supabase-browser");
      const supa = createSupabaseBrowserClient();
      const { data } = await supa
        .from("profiles")
        .select("settings")
        .eq("id", uid)
        .maybeSingle();
      if (data?.settings) server = normalize(data.settings);
    } catch {}
    cache = server || defaultData();
    if (mutatedDuringInit || dirty) flush(true); // don't lose edits made while hydrating
    hydrated = true;
    emit();
  })();
  return initPromise;
}

export async function ready(): Promise<void> {
  if (initPromise) await initPromise;
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

// ── Usage (server-authoritative mirror — /api/chat also writes it) ──
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
