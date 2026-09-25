import { NextRequest, NextResponse } from "next/server";
import { resolveStoreTarget, readStoreData } from "@/lib/store-server";
import { runDueTasks, nextRunAt } from "@/lib/tasks";
import { normalizeSmtp, sendMail } from "@/lib/email";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const KINDS = ["once", "daily", "weekdays", "weekly"];

async function listFor(owner: { kind: string; id: string }) {
  const { data } = await supa
    .from("tasks")
    .select("*")
    .eq("owner_type", owner.kind)
    .eq("owner_id", owner.id)
    .order("run_at", { ascending: true })
    .limit(50);
  return data || [];
}

export async function GET(request: NextRequest) {
  try {
    const owner = await resolveStoreTarget(request);
    if (!owner) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    // Opening the schedule panel also kicks due tasks (Hobby cron runs daily only).
    await runDueTasks().catch(() => {});
    const tasks = await listFor(owner);
    const store = await readStoreData(owner as any).catch(() => null);
    const emailCfg = store?.settings?.prefs?.email || {};
    return NextResponse.json({
      tasks,
      email: { host: emailCfg.host || "", port: emailCfg.port || 587, user: emailCfg.user || "" },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await resolveStoreTarget(request);
    if (!owner) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (action === "create") {
      const prompt = String(body.prompt || "").trim();
      if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });
      const kind = KINDS.includes(body.kind) ? body.kind : "once";
      let runAt: Date;
      if (kind === "once") {
        runAt = body.runAt ? new Date(body.runAt) : new Date(Date.now() + 60_000);
        if (isNaN(runAt.getTime())) return NextResponse.json({ error: "Invalid time" }, { status: 400 });
        if (runAt.getTime() < Date.now() - 60_000) runAt = new Date(Date.now() + 60_000);
      } else {
        // next occurrence of HH:MM (client sends UTC ms-of-day via runAt time)
        runAt = body.runAt ? new Date(body.runAt) : (() => {
          const d = new Date();
          d.setHours(8, 0, 0, 0);
          if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
          return d;
        })();
      }
      const email = body.email ? String(body.email).slice(0, 200) : null;
      const { data, error } = await supa
        .from("tasks")
        .insert({
          owner_type: owner.kind,
          owner_id: owner.id,
          prompt,
          kind,
          run_at: runAt.toISOString(),
          email,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ task: data });
    }

    if (action === "update") {
      const patch: any = {};
      if (body.status === "pending" || body.status === "paused") patch.status = body.status;
      if (body.email !== undefined) patch.email = body.email || null;
      if (patch.status === "pending" && body.resetRun && body.kind) {
        patch.run_at = nextRunAt(String(body.kind), new Date()).toISOString();
      }
      const { data, error } = await supa
        .from("tasks")
        .update(patch)
        .eq("id", body.id)
        .eq("owner_type", owner.kind)
        .eq("owner_id", owner.id)
        .select();
      if (error) throw error;
      return NextResponse.json({ task: data?.[0] || null });
    }

    if (action === "delete") {
      const { error } = await supa
        .from("tasks")
        .delete()
        .eq("id", body.id)
        .eq("owner_type", owner.kind)
        .eq("owner_id", owner.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "runnow") {
      await supa
        .from("tasks")
        .update({ run_at: new Date().toISOString(), status: "pending", error: null })
        .eq("id", body.id)
        .eq("owner_type", owner.kind)
        .eq("owner_id", owner.id);
      const result = await runDueTasks().catch(() => ({ ran: 0, due: 0 }));
      const tasks = await listFor(owner);
      return NextResponse.json({ ok: true, ran: result.ran, tasks });
    }

    if (action === "emailtest") {
      const cfg = normalizeSmtp(body.smtp);
      if (!cfg) return NextResponse.json({ error: "SMTP user & password required" }, { status: 400 });
      const to = String(body.to || cfg.user).slice(0, 200);
      await sendMail(cfg, {
        to,
        subject: "Founda Agent — SMTP test",
        text: `SMTP is configured correctly.\n\nHost: ${cfg.host}:${cfg.port}\nUser: ${cfg.user}\n\n— Founda Agent`,
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "saveemail") {
      // persist SMTP config into the owner's store prefs
      const { saveSettingsEmail } = await import("@/lib/store-server");
      await saveSettingsEmail(owner as any, body.smtp || null);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
