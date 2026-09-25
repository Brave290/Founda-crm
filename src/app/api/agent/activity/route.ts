import { NextRequest, NextResponse } from "next/server";
import { ensureServer } from "@/lib/opencode";
import { stepFromPart, type Step } from "@/lib/agent-activity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("session") || "";
    if (!/^ses_[A-Za-z0-9]+$/.test(id)) {
      return NextResponse.json({ busy: false, todos: [], steps: [] });
    }

    const client: any = await ensureServer();
    const directory = process.env.OPENCODE_WORKSPACE || "/tmp/oc-workspace";

    const [msgsRes, todoRes, statusRes] = await Promise.all([
      client.session.messages({ sessionID: id, directory, limit: 100 }).catch(() => null),
      client.session.todo({ sessionID: id, directory }).catch(() => null),
      client.session.status({ directory }).catch(() => null),
    ]);

    const msgList: any[] = Array.isArray(msgsRes?.data)
      ? msgsRes.data
      : Array.isArray(msgsRes?.data?.data)
        ? msgsRes.data.data
        : [];

    const steps: Step[] = [];
    for (const m of msgList) {
      const parts: any[] = Array.isArray(m?.parts) ? m.parts : [];
      for (const part of parts) {
        const step = stepFromPart(part);
        if (step) steps.push(step);
      }
    }

    const todos: any[] = Array.isArray(todoRes?.data)
      ? todoRes.data
      : Array.isArray(todoRes?.data?.data)
        ? todoRes.data.data
        : [];

    const statuses = statusRes?.data || {};
    const mine = statuses[id];
    const busy =
      mine?.type === "busy" ||
      steps.some((s) => s.status === "running" || s.status === "pending");

    return NextResponse.json({ busy, todos, steps: steps.slice(-60) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
