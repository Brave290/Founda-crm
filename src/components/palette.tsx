"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";

export interface PaletteAction {
  id: string;
  label: string;
  hint?: string;
  group?: string;
  icon?: React.ReactNode;
  run: () => void;
}

export function CommandPalette({
  actions,
  onClose,
}: {
  actions: PaletteAction[];
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const list = useMemo(() => {
    const s = q.toLowerCase().trim();
    if (!s) return actions;
    return actions.filter((a) =>
      `${a.label} ${a.hint || ""} ${a.group || ""} ${a.id}`.toLowerCase().includes(s)
    );
  }, [q, actions]);

  useEffect(() => setIdx(0), [q]);

  const run = (a?: PaletteAction) => {
    if (!a) return;
    onClose();
    setTimeout(() => a.run(), 0);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => (list.length ? (i + 1) % list.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => (list.length ? (i - 1 + list.length) % list.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(list[idx]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[18vh] px-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0e1628]/95 backdrop-blur-2xl shadow-2xl shadow-black/60 overflow-hidden animate-scale-in">
        <div className="flex items-center gap-2.5 px-4 border-b border-white/[0.07]">
          <SearchIcon size={15} className="text-slate-500 shrink-0" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-600 focus:outline-none"
          />
          <kbd className="hidden sm:block text-[10px] text-slate-600 border border-white/10 rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>

        <div className="max-h-[46vh] overflow-y-auto py-1.5">
          {list.length === 0 && (
            <div className="px-4 py-6 text-center text-[13px] text-slate-600">
              No matches
            </div>
          )}
          {list.map((a, i) => {
            const header = a.group && a.group !== lastGroup ? a.group : null;
            if (header) lastGroup = a.group!;
            return (
              <div key={a.id}>
                {header && (
                  <div className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-wider text-slate-600">
                    {header}
                  </div>
                )}
                <button
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => run(a)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                    i === idx ? "bg-emerald-500/[0.1] text-white" : "text-slate-400"
                  }`}
                >
                  {a.icon && (
                    <span
                      className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                        i === idx
                          ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                          : "bg-white/[0.05] text-slate-400"
                      }`}
                    >
                      {a.icon}
                    </span>
                  )}
                  <span className="flex-1 min-w-0 text-[13.5px] truncate">{a.label}</span>
                  {a.hint && (
                    <span className="text-[11px] text-slate-600 shrink-0">{a.hint}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t border-white/[0.07] flex items-center justify-between text-[10px] text-slate-600">
          <span>↑↓ navigate · ↵ run</span>
          <span className="gradient-text font-medium">Founda palette</span>
        </div>
      </div>
    </div>
  );
}
