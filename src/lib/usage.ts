import { createClient } from "@supabase/supabase-js";

// Server-authoritative usage tracking. The client mirrors usage in its cache
// for instant UI, but every chat completion also writes here — so the counter
// survives logout, refresh and device switches, and can't be reset locally.

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function recordUsage(
  owner: { kind: string; id: string },
  messages: number,
  tokens: number
): Promise<void> {
  try {
    if (owner.kind !== "user") return;
    const { data } = await supa
      .from("profiles")
      .select("settings")
      .eq("id", owner.id)
      .maybeSingle();
    const settings = data?.settings || {};
    const usage = settings.usage || {};
    if (usage.day !== today()) {
      usage.day = today();
      usage.messages = 0;
      usage.tokens = 0;
    }
    usage.messages = Number(usage.messages || 0) + messages;
    usage.tokens = Number(usage.tokens || 0) + tokens;
    settings.usage = usage;
    await supa.from("profiles").upsert({ id: owner.id, settings, updated_at: new Date().toISOString() });
  } catch {}
}

/** The account's email — used to notify users when background work finishes. */
export async function getAccountEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supa.auth.admin.getUserById(userId);
    if (error) return null;
    return data?.user?.email || null;
  } catch {
    return null;
  }
}
