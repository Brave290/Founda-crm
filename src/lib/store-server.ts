import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { verifySkillToken } from "@/lib/skill-token";

// Server-side store access shared by /api/store, /api/models and /api/chat.
// Auth: logged-in Supabase session only (cookie or mobile Bearer JWT).

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StoreTarget = { kind: "user"; id: string };

export async function resolveStoreTarget(req: Request): Promise<StoreTarget | null> {
  // Skill bearer injected into the model's system prompt by /api/chat — lets
  // the agent call the app's own APIs (email, fetch, search) as the user.
  const skillToken = req.headers.get("x-founda-token");
  if (skillToken) {
    const owner = verifySkillToken(skillToken);
    if (owner) return { kind: "user", id: owner.id };
  }
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return { kind: "user", id: user.id };
  } catch {}
  // Mobile (React Native) sends the Supabase JWT directly — no cookies there.
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    try {
      const { data } = await supa.auth.getUser(authHeader.slice(7));
      if (data?.user) return { kind: "user", id: data.user.id };
    } catch {}
  }
  return null;
}

export async function readStoreData(t: StoreTarget): Promise<Record<string, any>> {
  const { data } = await supa
    .from("profiles")
    .select("settings")
    .eq("id", t.id)
    .maybeSingle();
  return data?.settings || {};
}

export async function readStoreForRequest(req: Request): Promise<Record<string, any> | null> {
  const t = await resolveStoreTarget(req);
  if (!t) return null;
  return readStoreData(t);
}

/** Persist SMTP/email config into the owner's server-side settings.prefs.email. */
export async function saveSettingsEmail(t: StoreTarget, smtp: any): Promise<void> {
  const clean = smtp && smtp.user && smtp.pass
    ? {
        host: String(smtp.host || "smtp.gmail.com"),
        port: Number(smtp.port) || 587,
        user: String(smtp.user),
        pass: String(smtp.pass),
      }
    : null;
  const { data } = await supa.from("profiles").select("settings").eq("id", t.id).maybeSingle();
  const settings = data?.settings || {};
  const prefs = settings.prefs || {};
  settings.prefs = { ...prefs, email: clean };
  await supa.from("profiles").upsert({ id: t.id, settings, updated_at: new Date().toISOString() });
}
