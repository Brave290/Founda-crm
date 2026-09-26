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
  const appUrl = new URL("/", req.url);
  appUrl.searchParams.set("mcp_oauth", flag);
  if (error) appUrl.searchParams.set("mcp_error", description || error);
  const safeUrl = appUrl.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return new NextResponse(`<!doctype html><html><body style="font-family:system-ui;background:#0b1020;color:#cbd5e1;display:grid;place-items:center;height:100vh"><p>Returning to Founda…</p><script>window.close();</script><noscript><a href="${safeUrl}">Return to Founda</a></noscript></body></html>`, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
