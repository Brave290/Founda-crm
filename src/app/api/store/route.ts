import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveStoreTarget, type StoreTarget as Target } from "@/lib/store-server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 1_500_000; // one jsonb profile row — keep it sane

// Service-role client (bypasses RLS; access is scoped by route logic)
const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function readData(t: Target): Promise<Record<string, any>> {
  const { data } = await supa
    .from("profiles")
    .select("settings")
    .eq("id", t.id)
    .maybeSingle();
  return data?.settings || {};
}

export async function GET(req: Request) {
  const t = await resolveStoreTarget(req);
  if (!t) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const data = await readData(t);
    return NextResponse.json({ data, target: t.kind });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const t = await resolveStoreTarget(req);
  if (!t) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const data = body?.data;
    if (!data || typeof data !== "object")
      return NextResponse.json({ error: "data object required" }, { status: 400 });
    const serialized = JSON.stringify(data);
    if (serialized.length > MAX_BYTES)
      return NextResponse.json({ error: "payload too large" }, { status: 413 });

    const { error } = await supa
      .from("profiles")
      .upsert({ id: t.id, settings: data, updated_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const t = await resolveStoreTarget(req);
  if (!t) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await supa.from("profiles").upsert({ id: t.id, settings: {} });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
