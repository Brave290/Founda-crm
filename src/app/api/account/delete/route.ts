import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * Permanently deletes the signed-in user's account and all account-owned data.
 * This route is intentionally confirmation-gated and is only called by the
 * Delete my account control after the user explicitly confirms in the UI.
 */
export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: { confirmation?: string } = {};
  try { body = await request.json(); } catch {}
  if (body.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm account deletion" }, { status: 400 });
  }

  const uid = user.id;
  try {
    // These tables use text owner IDs and therefore do not cascade from auth.users.
    for (const [table, column, value] of [
      ["chat_runs", "owner_id", uid],
      ["tasks", "owner_id", uid],
    ] as const) {
      const { error } = await admin.from(table).delete().eq("owner_type", "user").eq(column, value);
      if (error) throw error;
    }

    // The remaining account tables either cascade from auth.users or are
    // explicitly removed first for clarity and for databases with older FKs.
    for (const table of ["mcp_connections", "repos", "activity_log", "session_exports", "agents", "sessions"]) {
      const { error } = await admin.from(table).delete().eq("user_id", uid);
      if (error) throw error;
    }

    // profiles is keyed by id (not user_id) — delete it before the auth user
    // so the auth.admin.deleteUser cascade has nothing left to trip over.
    const { error: profileError } = await admin.from("profiles").delete().eq("id", uid);
    if (profileError) throw profileError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Account deletion failed" }, { status: 500 });
  }
}
