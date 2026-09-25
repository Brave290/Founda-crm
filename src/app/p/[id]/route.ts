import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const NOT_FOUND = `<!doctype html><html><head><meta charset="utf-8"><title>Not found</title>
<style>body{font-family:system-ui;background:#0b1120;color:#94a3b8;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}h1{color:#e2e8f0}</style></head>
<body><div style="text-align:center"><h1>404</h1><p>This page doesn't exist or was removed.</p></div></body></html>`;

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id || "";
  if (!/^[a-z0-9]{8,20}$/.test(id)) {
    return new Response(NOT_FOUND, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  try {
    const { data } = await supa.from("public_pages").select("html").eq("id", id).maybeSingle();
    if (!data?.html) {
      return new Response(NOT_FOUND, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    return new Response(data.html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // unique origin: published scripts can't touch Founda cookies/storage
        "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups allow-modals",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(NOT_FOUND, { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}
