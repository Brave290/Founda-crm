import { NextRequest, NextResponse } from "next/server";
import { ensureServer } from "@/lib/opencode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Step {
  id: string;
  tool: string;
  title: string;
  detail: string;
  status: "pending" | "running" | "completed" | "error";
  output: string;
  start?: number;
  end?: number;
}

function toolDetail(tool: string, input: any): string {
  if (!input || typeof input !== "object") return "";
  const cand = [
    "command", "cmd", "url", "filePath", "path", "file_path",
    "pattern", "query", "description", "prompt", "topic", "site",
  ];
  for (const k of cand) {
    const v = input[k];
    if (typeof v === "string" && v) return v.slice(0, 300);
  }
  return "";
}

function toolTitle(tool: string, input: any, fallback?: string): string {
  if (fallback) return fallback;
  const n = (tool || "").toLowerCase();
  if (n.includes("bash") || n.includes("shell") || n.includes("execute")) return "Running terminal command";
  if (n.includes("webfetch") || n.includes("fetch")) return "Fetching page";
  if (n.includes("websearch") || n.includes("search")) return "Searching the web";
  if (n.includes("grep") || n.includes("glob") || n.includes("find")) return "Searching files";
  if (n.includes("read")) return "Reading file";
  if (n.includes("write") || n.includes("edit") || n.includes("patch")) return "Editing files";
  if (n.includes("todo")) return "Updating task list";
  if (n.includes("task") || n.includes("agent")) return "Delegating to subagent";
  if (n.includes("question")) return "Asking a question";
  return tool;
}

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
        if (part?.type !== "tool") continue;
        const st = part.state || {};
        const input = st.input || {};
        const output =
          typeof st.output === "string"
            ? st.output.slice(-4000)
            : typeof st.error === "string"
              ? st.error.slice(0, 2000)
              : "";
        steps.push({
          id: part.id || `${part.callID}`,
          tool: part.tool || "tool",
          title: toolTitle(part.tool, input, st.title),
          detail: toolDetail(part.tool, input),
          status: st.status || "pending",
          output,
          start: st.time?.start,
          end: st.time?.end,
        });
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
