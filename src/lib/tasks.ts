import { createClient } from "@supabase/supabase-js";
import { ensureServer, setProviderAuth, listNativeModels } from "@/lib/opencode";
import { buildModelChain, keyForModel, DEFAULT_MODEL } from "@/lib/models";
import { readStoreData } from "@/lib/store-server";
import { resolveSmtp, sendMail } from "@/lib/email";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function splitModel(m: string): { providerID: string; modelID: string } {
  const i = m.indexOf("/");
  return i === -1 ? { providerID: m, modelID: "default" } : { providerID: m.slice(0, i), modelID: m.slice(i + 1) };
}

export interface TaskRow {
  id: string;
  owner_type: string;
  owner_id: string;
  prompt: string;
  kind: string;
  run_at: string;
  email: string | null;
  status: string;
  last_result: string | null;
  last_run: string | null;
  error: string | null;
  created_at: string;
}

export function nextRunAt(kind: string, from: Date): Date {
  const d = new Date(from.getTime());
  if (kind === "weekly") {
    d.setDate(d.getDate() + 7);
    return d;
  }
  if (kind === "weekdays") {
    do {
      d.setDate(d.getDate() + 1);
    } while (d.getDay() === 0 || d.getDay() === 6);
    return d;
  }
  // daily / default
  d.setDate(d.getDate() + 1);
  return d;
}

async function executeTask(t: TaskRow): Promise<string> {
  const client: any = await ensureServer();
  const directory = process.env.OPENCODE_WORKSPACE || "/tmp/oc-workspace";

  const target =
    t.owner_type === "user"
      ? ({ kind: "user", id: t.owner_id } as const)
      : ({ kind: "guest", id: t.owner_id } as const);
  const store = await readStoreData(target as any).catch(() => null);
  const storeKeys = store?.settings?.apiKeys || {};
  const requested = store?.settings?.prefs?.model || "";
  // Same chain shape as /api/chat: picked model → latest MiMo (keyless, fast)
  // → other native free models → catalog. The old chain started at key-gated
  // catalog models, so keyless users hit engine errors ("Expected 'id'…")
  // before ever reaching a working model.
  const nativeFree = (await listNativeModels())
    .filter((m: any) => m?.providerID === "opencode" && m?.enabled !== false && m?.status !== "deprecated")
    .slice(0, 5)
    .map((m: any) => `opencode/${m.id}`);
  const chain: string[] = [];
  for (const id of [requested, DEFAULT_MODEL, ...nativeFree, ...buildModelChain(requested, storeKeys, process.env), "pollinations/openai-fast"]) {
    if (id && !chain.includes(id)) chain.push(id);
  }

  const created: any = await client.session.create({
    title: `Scheduled: ${String(t.prompt).slice(0, 50)}`,
    directory,
    agent: "general",
  });
  const sid = created?.data?.id;
  if (!sid) throw new Error("Failed to create engine session");

  const parts = [
    {
      type: "text",
      text:
        `${t.prompt}\n\n` +
        "This is a scheduled autonomous task. Complete it now, using your tools (webfetch, search, files) where useful. " +
        "When finished, output a clear, concise summary of what you did and the result — this text will be emailed to the user.",
    },
  ];

  let lastErr = "no model available";
  for (const m of chain.slice(0, 6)) {
    try {
      const k = keyForModel(m, storeKeys, process.env);
      if (k) {
        try { await setProviderAuth(k.provider, k.key); } catch {}
      }
      const res: any = await client.session.prompt({
        sessionID: sid,
        directory,
        parts,
        model: splitModel(m),
        agent: "general",
      });
      const info = res?.data?.info;
      if (info?.error) throw new Error(JSON.stringify(info.error).slice(0, 400));
      const texts = (res?.data?.parts || [])
        .filter((p: any) => p.type === "text" && !p.synthetic)
        .map((p: any) => p.text);
      const out = String(texts.join("\n")).trim();
      if (out) return out;
      throw new Error("empty output");
    } catch (e: any) {
      lastErr = e?.message || String(e);
    }
  }
  throw new Error(lastErr);
}

async function notify(t: TaskRow, result: string): Promise<string> {
  if (!t.email) return result;
  try {
    const store = await readStoreData(
      (t.owner_type === "user"
        ? { kind: "user", id: t.owner_id }
        : { kind: "guest", id: t.owner_id }) as any
    ).catch(() => null);
    const smtp = resolveSmtp(store?.settings?.prefs?.email);
    if (!smtp) return result + "\n\n(Email not sent: SMTP is not configured in Settings → Schedule.)";
    await sendMail(smtp, {
      to: t.email,
      subject: `✅ Task done: ${String(t.prompt).slice(0, 60)}`,
      text:
        `Your scheduled task finished.\n\nTask:\n${t.prompt}\n\n` +
        `Result:\n${result.slice(0, 9000)}\n\n— Founda Agent`,
    });
    return result;
  } catch (e: any) {
    return result + `\n\n(Email failed: ${String(e?.message || e).slice(0, 200)})`;
  }
}

/** Run every due task (pending && run_at <= now+2min). Safe to call often. */
export async function runDueTasks(): Promise<{ ran: number; due: number }> {
  const horizon = new Date(Date.now() + 360_000).toISOString();
  const { data: due } = await supa
    .from("tasks")
    .select("*")
    .eq("status", "pending")
    .lte("run_at", horizon)
    .order("run_at", { ascending: true })
    .limit(3);
  const rows: TaskRow[] = (due as TaskRow[]) || [];
  if (!rows.length) return { ran: 0, due: 0 };

  let ran = 0;
  for (const t of rows) {
    // claim atomically — another runner may have picked it up
    const { data: claimed } = await supa
      .from("tasks")
      .update({ status: "running" })
      .eq("id", t.id)
      .eq("status", "pending")
      .select("id");
    if (!claimed?.length) continue;

    try {
      let result = await executeTask(t);
      result = await notify(t, result);
      const patch: any = {
        last_result: result.slice(0, 12000),
        last_run: new Date().toISOString(),
        error: null,
      };
      if (t.kind === "once") {
        patch.status = "done";
      } else {
        patch.status = "pending";
        patch.run_at = nextRunAt(t.kind, new Date(t.run_at)).toISOString();
      }
      await supa.from("tasks").update(patch).eq("id", t.id);
      ran++;
    } catch (e: any) {
      await supa
        .from("tasks")
        .update({
          status: "failed",
          error: String(e?.message || e).slice(0, 500),
          last_run: new Date().toISOString(),
        })
        .eq("id", t.id);
    }
  }
  return { ran, due: rows.length };
}
