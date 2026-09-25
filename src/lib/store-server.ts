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
