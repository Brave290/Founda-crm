"use client";

import { useState } from "react";
import {
  CodeIcon, GlobeIcon, SearchIcon, CheckCircleIcon, ClipboardIcon,
  FolderIcon, BotIcon, WrenchIcon, XIcon, CheckIcon, ClockIcon,
} from "@/components/icons";

export interface AgentActivityData {
  busy: boolean;
  todos: { id: string; content: string; status: string; priority?: string }[];
  steps: {
    id: string;
    tool: string;
    title: string;
    detail: string;
    status: "pending" | "running" | "completed" | "error";
    output: string;
    start?: number;
    end?: number;
  }[];
}

function toolIcon(tool: string, size = 14) {
  const n = (tool || "").toLowerCase();
  if (n.includes("bash") || n.includes("shell") || n.includes("execute")) return <CodeIcon size={size} />;
  if (n.includes("webfetch") || n.includes("fetch")) return <GlobeIcon size={size} />;
  if (n.includes("websearch") || n.includes("search") || n.includes("grep") || n.includes("glob") || n.includes("find"))
    return <SearchIcon size={size} />;
  if (n.includes("todo")) return <CheckCircleIcon size={size} />;
  if (n.includes("read")) return <FolderIcon size={size} />;
  if (n.includes("task") || n.includes("agent")) return <BotIcon size={size} />;
  if (n.includes("write") || n.includes("edit") || n.includes("patch")) return <ClipboardIcon size={size} />;
  return <WrenchIcon size={size} />;
}

function statusDot(status: string) {
  if (status === "running")
    return <span className="h-3.5 w-3.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin shrink-0" />;
  if (status === "completed")
    return <CheckIcon size={13} className="text-emerald-400 shrink-0" />;
  if (status === "error")
    return <XIcon size={13} className="text-red-400 shrink-0" />;
  return <span className="h-2 w-2 rounded-full bg-slate-600 shrink-0" />;
}

function todoIcon(status: string) {
  if (status === "completed")
    return <span className="h-4.5 w-4.5 flex items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/40"><CheckIcon size={11} className="text-emerald-400" /></span>;
  if (status === "in_progress" || status === "in-progress")
    return <span className="h-4.5 w-4.5 flex items-center justify-center rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />;
  if (status === "cancelled")
    return <span className="h-4.5 w-4.5 flex items-center justify-center rounded-full border border-slate-700 text-slate-600 text-[9px]">×</span>;
  return <span className="h-4.5 w-4.5 flex items-center justify-center rounded-full border border-slate-700" />;
}

export function AgentActivity({ activity }: { activity: AgentActivityData }) {
  const [open, setOpen] = useState(false);
  const [openStep, setOpenStep] = useState<string | null>(null);

  const { todos, steps, busy } = activity;
  const last = steps[steps.length - 1];
  const todosDone = todos.filter((t) => t.status === "completed").length;

  const currentLabel = busy && last
    ? last.detail
      ? `${last.title} — ${last.detail}`
      : last.title
    : last
      ? last.title
      : "Working…";

  return (
    <>
      {/* Collapsed bar — sits above the composer */}
      <button
        onClick={() => setOpen(true)}
        className="w-full mb-2 rounded-xl border border-white/[0.08] bg-[#101625] hover:border-white/[0.16] px-3.5 py-2.5 flex items-center gap-3 text-left transition-colors group"
        title="Open agent activity"
      >
        <span className={`shrink-0 h-4 w-4 rounded-full border-2 border-emerald-400 ${busy ? "border-t-transparent animate-spin" : "border-solid"}`} />
        <span className="flex-1 min-w-0">
          <span className="block text-[12.5px] text-slate-300 group-hover:text-white truncate transition-colors">
            {currentLabel}
          </span>
          <span className="block text-[10.5px] text-slate-600 truncate">
            {steps.length} step{steps.length === 1 ? "" : "s"}
            {todos.length > 0 && ` · ${todosDone}/${todos.length} todos`}
            {busy ? " · working…" : " · idle"}
          </span>
        </span>
        {todos.length > 0 && (
          <span className="hidden sm:block w-24 h-1.5 rounded-full bg-white/[0.06] overflow-hidden shrink-0">
            <span
              className="block h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${Math.round((todosDone / todos.length) * 100)}%` }}
            />
          </span>
        )}
        <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
        </svg>
      </button>

      {/* Fullscreen view */}
      {open && (
        <div className="fixed inset-0 z-[95] bg-[#0b0f17] flex flex-col animate-fade-in">
          <div className="h-12 px-4 flex items-center justify-between border-b border-white/[0.07] shrink-0">
            <div className="flex items-center gap-3">
              <span className={`h-3.5 w-3.5 rounded-full border-2 border-emerald-400 ${busy ? "border-t-transparent animate-spin" : ""}`} />
              <span className="text-[14px] text-white font-medium">Agent activity</span>
              <span className="text-[11.5px] text-slate-600">
                {steps.length} steps · {todosDone}/{todos.length} todos
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Close"
            >
              <XIcon size={16} />
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            {/* Todos */}
            <div className="lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.07] overflow-y-auto p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-3">Task list</div>
              {todos.length === 0 && (
                <p className="text-[12.5px] text-slate-600">No to-do list yet — the agent creates one for multi-step jobs.</p>
              )}
              <div className="space-y-2.5">
                {todos.map((t) => (
                  <div key={t.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5">{todoIcon(t.status)}</span>
                    <span className={`text-[13px] leading-snug ${
                      t.status === "completed" ? "text-slate-600 line-through" :
                      t.status === "in_progress" || t.status === "in-progress" ? "text-white" : "text-slate-400"
                    }`}>
                      {t.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Steps */}
            <div className="flex-1 min-w-0 overflow-y-auto p-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-3">What the agent did</div>
              {steps.length === 0 && (
                <p className="text-[12.5px] text-slate-600">Waiting for the first action…</p>
              )}
              <div className="space-y-1.5">
                {steps.map((s) => (
                  <div key={s.id}>
                    <button
                      onClick={() => setOpenStep(openStep === s.id ? null : s.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 flex items-start gap-3 transition-colors ${
                        s.status === "running"
                          ? "border-emerald-500/30 bg-emerald-500/[0.05]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                      }`}
                    >
                      <span className="mt-0.5 text-slate-500 shrink-0">{toolIcon(s.tool)}</span>
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2">
                          <span className="text-[13px] text-slate-200 truncate">{s.title}</span>
                        </span>
                        {s.detail && (
                          <span className="block text-[11.5px] font-mono text-slate-600 truncate mt-0.5">
                            {s.detail}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5">{statusDot(s.status)}</span>
                    </button>

                    {openStep === s.id && (s.output || s.detail) && (
                      <div className="mt-1 mb-2 rounded-lg border border-white/[0.06] bg-black/50 p-3 animate-scale-in">
                        {(s.tool || "").toLowerCase().includes("bash") || (s.tool || "").toLowerCase().includes("shell") ? (
                          <div className="text-[12px] font-mono text-emerald-300/90 mb-1.5">$ {s.detail}</div>
                        ) : null}
                        <pre className="text-[11.5px] font-mono text-slate-400 whitespace-pre-wrap break-words max-h-72 overflow-y-auto leading-relaxed">
                          {s.output || s.detail}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
