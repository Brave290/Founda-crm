import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function newId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const html = typeof body.html === "string" ? body.html : "";
    const title = typeof body.title === "string" ? body.title.slice(0, 120) : "Untitled site";
    if (!html.trim()) return NextResponse.json({ error: "html required" }, { status: 400 });
    if (html.length > 800_000) return NextResponse.json({ error: "Too large (max 800KB)" }, { status: 413 });

    for (let attempt = 0; attempt < 3; attempt++) {
      const id = newId();
      const { error } = await supa.from("public_pages").insert({ id, title, html });
      if (!error) return NextResponse.json({ id, url: `/p/${id}` });
      if (!String(error.message || "").includes("duplicate")) throw error;
    }
    return NextResponse.json({ error: "Could not allocate slug" }, { status: 500 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
