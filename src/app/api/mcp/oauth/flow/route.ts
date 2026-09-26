import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { startMcpAuth, finishMcpAuth } from "@/lib/opencode";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET /api/mcp/oauth/flow?name=<server>
 *
 * SSE endpoint that holds THIS function instance (and its opencode engine,
 * which owns the PKCE verifier) for the whole browser OAuth dance:
 *   1. starts the flow → streams the authorization URL (client opens it in a
 *      new tab so this connection stays alive)
 *   2. polls Supabase for the code our public /api/mcp/oauth/callback stored
 *   3. exchanges it locally and streams { done }.
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return new Response("missing name", { status: 400 });

  const enc = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: any) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };

      try {
        const started = await startMcpAuth(name);
        const url = started.authorizationUrl;
        if (!url) {
          // no URL ⇒ already authenticated
          send("done", { status: "connected" });
          close();
          return;
        }
        let state = started.oauthState || "";
        if (!state) {
          try {
            state = new URL(url).searchParams.get("state") || "";
          } catch {}
        }
        send("auth", { authorizationUrl: url, state });

        const deadline = Date.now() + 240_000;
        while (Date.now() < deadline && !closed) {
          if (req.signal?.aborted) break;
          await sleep(1200);
          try {
            const { data } = await supa
              .from("mcp_auth_codes")
              .select("code")
              .eq("state", state)
              .maybeSingle();
            if (data?.code) {
              const status: any = await finishMcpAuth(name, data.code);
              await supa.from("mcp_auth_codes").delete().eq("state", state);
              send("done", { status: status?.status || "connected" });
              close();
              return;
            }
          } catch {}
        }
        if (!closed) send("error", { error: "Authorization timed out — try again." });
      } catch (e: any) {
        send("error", { error: e?.message || "OAuth flow failed" });
      }
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
