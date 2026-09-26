import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * Public OAuth landing: the provider redirects the user's browser here with
 * ?code&state. We stash the code in Supabase so the flow instance (which owns
 * the PKCE verifier) can pick it up and finish the exchange, then send the
 * user back to the app.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const code = p.get("code");
  const state = p.get("state");
  const error = p.get("error");
  const description = p.get("error_description");

  if (state && code) {
    try {
      await supa
        .from("mcp_auth_codes")
        .upsert({ state, name: p.get("n") || "", code }, { onConflict: "state" });
    } catch {}
  }

  const flag = error ? "error" : code ? "ok" : "missing";
  const url = new URL("/", req.url);
  url.searchParams.set("mcp_oauth", flag);
  if (error) url.searchParams.set("mcp_error", description || error);
  return NextResponse.redirect(url);
}
