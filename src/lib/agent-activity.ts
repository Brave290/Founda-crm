export interface Step {
  id: string;
  tool: string;
  title: string;
  detail: string;
  status: "pending" | "running" | "completed" | "error";
  output: string;
  start?: number;
  end?: number;
}

export function toolDetail(tool: string, input: any): string {
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

export function toolTitle(tool: string, input: any, fallback?: string): string {
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

/** Map an opencode tool Part (from message list or message.part.updated event) to a Step. */
export function stepFromPart(part: any): Step | null {
  if (!part || part.type !== "tool") return null;
  const st = part.state || {};
  const input = st.input || {};
  const output =
    typeof st.output === "string"
      ? st.output.slice(-4000)
      : typeof st.error === "string"
        ? st.error.slice(0, 2000)
        : "";
  return {
    id: part.id || String(part.callID || ""),
    tool: part.tool || "tool",
    title: toolTitle(part.tool, input, st.title),
    detail: toolDetail(part.tool, input),
    status: st.status || "pending",
    output,
    start: st.time?.start,
    end: st.time?.end,
  };
}
