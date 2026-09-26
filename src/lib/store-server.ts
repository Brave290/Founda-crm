import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Server-side store access shared by /api/store, /api/models and /api/chat.
// Auth: logged-in cookie (Supabase session) or guest x-device-id header.

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StoreTarget = { kind: "user"; id: string } | { kind: "guest"; id: string };

export async function resolveStoreTarget(req: Request): Promise<StoreTarget | null> {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) return { kind: "user", id: user.id };
  } catch {}
  const device = req.headers.get("x-device-id");
  if (device && UUID_RE.test(device)) return { kind: "guest", id: device };
  // Cookie fallback: localStorage can be wiped, the 1-year identity cookie
  // cannot (without also clearing cookies), so usage/sessions never reset.
  const cookie = req.headers.get("cookie") || "";
  const cm = /(?:^|;\s*)founda_device=([0-9a-f-]{36})/i.exec(cookie);
  if (cm && UUID_RE.test(cm[1])) return { kind: "guest", id: cm[1] };
  return null;
}

export async function readStoreData(t: StoreTarget): Promise<Record<string, any>> {
  if (t.kind === "user") {
    const { data } = await supa
      .from("profiles")
      .select("settings")
      .eq("id", t.id)
      .maybeSingle();
    return data?.settings || {};
  }
  const { data } = await supa
    .from("guest_data")
    .select("data")
    .eq("device_id", t.id)
    .maybeSingle();
  return data?.data || {};
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
  if (t.kind === "user") {
    const { data } = await supa.from("profiles").select("settings").eq("id", t.id).maybeSingle();
    const settings = data?.settings || {};
    const prefs = settings.prefs || {};
    settings.prefs = { ...prefs, email: clean };
    await supa.from("profiles").upsert({ id: t.id, settings, updated_at: new Date().toISOString() });
    return;
  }
  const { data } = await supa.from("guest_data").select("data").eq("device_id", t.id).maybeSingle();
  const store = data?.data || {};
  store.settings = store.settings || { apiKeys: {}, prefs: {}, usage: {} };
  store.settings.prefs = { ...(store.settings.prefs || {}), email: clean };
  await supa.from("guest_data").upsert({ device_id: t.id, data: store });
}
