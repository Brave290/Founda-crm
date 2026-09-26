import { createClient } from "@supabase/supabase-js";
import type { StoreTarget } from "@/lib/store-server";

// Manus-style background runs: every chat prompt is recorded here so the work
// and its result survive the user closing the tab. The SSE stream is just a
// live view; chat_runs is the durable record the page reconciles on load.

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export interface ChatRun {
  id: string;
  owner_type: string;
  owner_id: string;
  session_id: string;
  prompt: string;
  reply: string | null;
  status: string; // running | done | failed
  error: string | null;
  model: string | null;
  created_at: string;
  updated_at: string;
}

export async function startRun(
  t: StoreTarget,
  opts: { runId: string; clientSessionId: string; prompt: string; agent?: string }
): Promise<void> {
  try {
    await supa.from("chat_runs").upsert(
      {
        id: opts.runId,
        owner_type: t.kind,
        owner_id: t.id,
        session_id: opts.clientSessionId,
        prompt: String(opts.prompt || "").slice(0, 20000),
        agent: opts.agent || null,
        status: "running",
        error: null,
        reply: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
  } catch {}
}

export async function finishRun(runId: string | null, reply: string, model?: string): Promise<void> {
  if (!runId) return;
  try {
    await supa
      .from("chat_runs")
      .update({
        status: "done",
        reply: String(reply || "").slice(0, 60000),
        model: model || null,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);
  } catch {}
}

export async function failRun(runId: string | null, error: string): Promise<void> {
  if (!runId) return;
  try {
    await supa
      .from("chat_runs")
      .update({
        status: "failed",
        error: String(error || "failed").slice(0, 1000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId);
  } catch {}
}

/** Heartbeat so the page can tell a live run from a dead function. */
export async function touchRun(runId: string | null): Promise<void> {
  if (!runId) return;
  try {
    await supa.from("chat_runs").update({ updated_at: new Date().toISOString() }).eq("id", runId);
  } catch {}
}

export async function listRuns(t: StoreTarget, clientSessionId: string): Promise<ChatRun[]> {
  try {
    const { data } = await supa
      .from("chat_runs")
      .select("*")
      .eq("owner_type", t.kind)
      .eq("owner_id", t.id)
      .eq("session_id", clientSessionId)
      .order("created_at", { ascending: true })
      .limit(50);
    return (data as ChatRun[]) || [];
  } catch {
    return [];
  }
}
