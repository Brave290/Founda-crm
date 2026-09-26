"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, loadGuestSessions, saveGuestSession, deleteGuestSession, GuestSession } from "@/lib/auth";
import { SearchIcon, PlusIcon, MessageIcon, XIcon, SettingsIcon } from "@/components/icons";

export function Sidebar({
  open,
  onClose,
  currentId,
  onOpenSettings,
}: {
  open: boolean;
  onClose: () => void;
  currentId?: string;
  onOpenSettings: () => void;
}) {
  const router = useRouter();
  const { user, guest } = useAuth();
  const [q, setQ] = useState("");
  const [guestList, setGuestList] = useState<GuestSession[]>([]);
  const [acctList, setAcctList] = useState<any[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string; title: string; guest: boolean } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string; guest: boolean } | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  useEffect(() => {
    if (!menu && !renaming) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenu(null); setRenaming(null); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [menu, renaming]);

  const isGuestNav = false;

  const refresh = () => {
    setGuestList(loadGuestSessions());
    if (user) {
      import("@/lib/supabase-browser")
        .then(({ createSupabaseBrowserClient }) => {
          const sb = createSupabaseBrowserClient();
          return sb
            .from("sessions")
            .select("id, title, updated_at, message_count, agent_name")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(100);
        })
        .then(({ data }: any) => setAcctList(data || []))
        .catch(() => {});
    } else {
      setAcctList([]);
    }
  };

  useEffect(() => {
    refresh();
    const historyPoll = user ? window.setInterval(refresh, 5000) : undefined;
    let unsub: (() => void) | undefined;
    import("@/lib/store").then(async (st) => {
      await st.ready();
      const p = st.getPrefs();
      if (Array.isArray(p.pinned)) setPinned(p.pinned.map(String));
      unsub = st.subscribe(() => refresh());
    }).catch(() => {});
    return () => {
      if (historyPoll) window.clearInterval(historyPoll);
      unsub?.();
    };
  }, [user]);

  const savePinned = (next: string[]) => {
    setPinned(next);
    import("@/lib/store").then((st) => st.savePrefs({ pinned: next })).catch(() => {});
  };

  const menuAct = async (action: "rename" | "pin" | "clone" | "delete") => {
    const it = menu;
    setMenu(null);
    if (!it) return;
    if (action === "rename") {
      setRenameDraft(it.title);
      setRenaming({ id: it.id, title: it.title, guest: it.guest });
      return;
    }
    if (action === "pin") {
      savePinned(pinned.includes(it.id) ? pinned.filter((x) => x !== it.id) : [...pinned, it.id]);
      return;
    }
    if (action === "delete") {
      if (!confirm(`Delete "${it.title}"? This cannot be undone.`)) return;
      try {
        if (it.guest || !user) {
          deleteGuestSession(it.id);
        } else {
          const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
          await createSupabaseBrowserClient().from("sessions").delete().eq("id", it.id).eq("user_id", user.id);
        }
      } catch {}
      refresh();
      return;
    }
    if (action === "clone") {
      try {
        if (it.guest || !user) {
          const src = loadGuestSessions().find((x) => x.id === it.id);
          if (!src) return;
          saveGuestSession({ ...src, id: crypto.randomUUID(), title: `${src.title} (copy)`, createdAt: new Date().toISOString() });
          refresh();
        } else {
          const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
          const sb = createSupabaseBrowserClient();
          const { data: src } = await sb.from("sessions").select("*").eq("id", it.id).single();
          const res = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "create",
              userId: user.id,
              title: `${src?.title || "Chat"} (copy)`,
              agentName: src?.agent_name || "build",
              model: src?.model || undefined,
              state: src?.state || {},
            }),
          });
          const d = await res.json();
          if (!d.session?.id) throw new Error(d.error || "clone failed");
          refresh();
          go(`/sessions/${d.session.id}`);
          return;
        }
      } catch (e) {
        console.error("clone failed", e);
        return;
      }
    }
  };

  const submitRename = async () => {
    const it = renaming;
    setRenaming(null);
    if (!it) return;
    const title = renameDraft.trim() || it.title;
    try {
      if (it.guest || !user) {
        const sessions = loadGuestSessions();
        const idx = sessions.findIndex((x) => x.id === it.id);
        if (idx >= 0) { sessions[idx].title = title; saveGuestSession(sessions[idx]); }
      } else {
        const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
        await createSupabaseBrowserClient().from("sessions").update({ title, updated_at: new Date().toISOString() }).eq("id", it.id).eq("user_id", user.id);
      }
    } catch {}
    refresh();
  };

  const term = q.toLowerCase().trim();
  const matches = (title: string, body?: string) =>
    !term || (title || "").toLowerCase().includes(term) || (body || "").toLowerCase().includes(term);

  const guestItems = guestList.filter((s) =>
    matches(s.title, (s.messages || []).map((m) => m.content).join(" "))
  );
  const acctItems = acctList.filter((s) => matches(s.title));

  const go = (path: string) => {
    router.push(path);
    onClose();
  };

  const newChat = () => go(`/sessions/${crypto.randomUUID()}`);

  const initial = user?.email?.[0]?.toUpperCase() || (guest ? "G" : "?");
  const displayName = user?.email?.split("@")[0] || (guest ? "Guest" : "User");

  return (
    <>
      {/* mobile backdrop — heavy blur over the page */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-2xl lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`${
          open ? "translate-x-0" : "-translate-x-full"
        } fixed lg:static inset-y-0 left-0 z-50 w-[272px] shrink-0 bg-[#0a0e17] border-r border-white/[0.06] flex flex-col transition-transform duration-200 lg:translate-x-0`}
      >
        {/* header */}
        <div className="p-3 flex items-center justify-between">
          <button
            onClick={newChat}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors border border-white/[0.08]"
          >
            <PlusIcon size={14} />
            New chat
          </button>
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-white"
            title="Close"
          >
            <XIcon size={15} />
          </button>
        </div>

        {/* search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <SearchIcon
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search history…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-white/15 transition-colors"
            />
          </div>
        </div>

        {/* history */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {acctItems.length + guestItems.length === 0 && (
            <div className="px-3 py-8 text-center text-[12px] text-slate-600">
              {term ? "No matches" : "No chats yet"}
            </div>
          )}

          {(() => {
            const rows = [
              ...acctItems.map((s) => ({
                id: s.id as string,
                title: s.title || "Untitled chat",
                ts: new Date(s.updated_at).getTime(),
                href: `/sessions/${s.id}`,
                guest: false,
              })),
              ...guestItems.map((s) => ({
                id: s.id as string,
                title: s.title || "Untitled chat",
                ts: new Date(s.createdAt).getTime(),
                href: `/sessions/${s.id}`,
                guest: true,
              })),
            ].sort((a, b) => b.ts - a.ts);
            const isPinned = (r: { id: string }) => pinned.includes(r.id);
            const pinnedRows = rows.filter(isPinned);
            const restRows = rows.filter((r) => !isPinned(r));

            const now = Date.now();
            const day = 86_400_000;
            const buckets: { label: string; list: typeof rows }[] = [
              { label: "Today", list: [] },
              { label: "Yesterday", list: [] },
              { label: "Previous 7 days", list: [] },
              { label: "Older", list: [] },
            ];
            for (const r of restRows) {
              const age = now - r.ts;
              if (age < day) buckets[0].list.push(r);
              else if (age < 2 * day) buckets[1].list.push(r);
              else if (age < 8 * day) buckets[2].list.push(r);
              else buckets[3].list.push(r);
            }
            const item = (r: { id: string; title: string; ts: number; href: string; guest: boolean }, extra?: React.ReactNode) => (
              <HistoryItem
                key={r.id}
                active={r.id === currentId}
                title={r.title}
                meta={new Date(r.ts).toLocaleDateString()}
                pinned={pinned.includes(r.id)}
                onClick={() => go(r.href)}
                onMenu={(x, y) => setMenu({ x, y, id: r.id, title: r.title, guest: r.guest })}
                extra={extra}
              />
            );

            return (
              <>
                {pinnedRows.length > 0 && (
                  <div>
                    <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-slate-600">Pinned</div>
                    {pinnedRows.map((r) => item(r))}
                  </div>
                )}
                {buckets.map((b) =>
                  b.list.length ? (
                    <div key={b.label}>
                      <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-slate-600">
                        {b.label}
                      </div>
                      {b.list.map((r) => item(r))}
                    </div>
                  ) : null
                )}
              </>
            );
          })()}
        </nav>

        {/* long-press / right-click context menu */}
        {menu && (
          <>
            <div
              className="fixed inset-0 z-[199]"
              onMouseDown={() => setMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setMenu(null); }}
            />
            <div
              className="fixed z-[200] min-w-[178px] rounded-xl border border-white/10 bg-gradient-to-b from-[#1b2542] via-[#151d33] to-[#101728] backdrop-blur-2xl shadow-[0_24px_60px_-16px_rgba(0,0,0,0.85)] p-1.5 animate-scale-in"
              style={{
                left: Math.max(8, Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 1000) - 190)),
                top: Math.max(8, Math.min(menu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 200)),
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {([
                ["rename", "Rename", "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"],
                ["pin", pinned.includes(menu.id) ? "Unpin" : "Pin to top", "M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"],
                ["clone", "Clone", "M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z"],
                ["delete", "Delete", "M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"],
              ] as const).map(([act, label, d]) => (
                <button
                  key={act}
                  onClick={() => menuAct(act as any)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[13px] flex items-center gap-2.5 transition-colors ${
                    act === "delete"
                      ? "text-red-300 hover:bg-red-500/15 hover:text-red-200"
                      : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" opacity="0.85"><path d={d} /></svg>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* rename dialog — colorful blur, click-outside closes */}
        {renaming && (
          <div
            className="fixed inset-0 z-[210] bg-black/60 backdrop-blur-2xl flex items-center justify-center px-6"
            onMouseDown={() => setRenaming(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-[#1a2340] to-[#101728] backdrop-blur-2xl p-5 shadow-2xl shadow-black/70 animate-scale-in"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="text-[14px] text-white font-medium mb-3">Rename chat</div>
              <input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitRename()}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-sm text-white focus:outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-500/15 transition-all"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setRenaming(null)} className="px-3.5 py-2 rounded-lg text-[13px] text-slate-400 hover:text-white transition-colors">
                  Cancel
                </button>
                <button onClick={submitRename} className="px-4 py-2 rounded-lg text-[13px] font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-colors">
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* profile → settings */}
        <div className="p-2 border-t border-white/[0.06]">
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors group"
          >
            <span className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-[13px] font-semibold flex items-center justify-center shrink-0">
              {initial}
            </span>
            <span className="flex-1 min-w-0 text-left">
              <span className="block text-[13px] text-slate-300 group-hover:text-white truncate">
                {displayName}
              </span>
              <span className="block text-[11px] text-slate-600">Settings</span>
            </span>
            <SettingsIcon size={15} className="text-slate-600 group-hover:text-slate-400" />
          </button>
        </div>
      </aside>
    </>
  );
}

function HistoryItem({
  title,
  meta,
  active,
  pinned,
  onClick,
  onMenu,
  extra,
}: {
  title: string;
  meta: string;
  active?: boolean;
  pinned?: boolean;
  onClick: () => void;
  onMenu: (x: number, y: number) => void;
  extra?: React.ReactNode;
}) {
  const pressTimer = useRef<number | null>(null);
  const longFired = useRef(false);

  const clearPress = () => {
    if (pressTimer.current) { window.clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  return (
    <button
      onClick={() => { if (longFired.current) { longFired.current = false; return; } onClick(); }}
      onContextMenu={(e) => { e.preventDefault(); longFired.current = true; onMenu(e.clientX, e.clientY); }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        const { clientX, clientY } = e;
        clearPress();
        pressTimer.current = window.setTimeout(() => {
          longFired.current = true;
          pressTimer.current = null;
          if (navigator.vibrate) navigator.vibrate(12);
          onMenu(clientX, clientY);
        }, 450);
      }}
      onPointerUp={clearPress}
      onPointerLeave={clearPress}
      onPointerCancel={clearPress}
      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-colors select-none ${
        active ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
      }`}
      title={`${title} — long-press or right-click for options`}
    >
      <MessageIcon size={14} className="shrink-0 text-slate-600" />
      <span className="flex-1 min-w-0 truncate text-[13px]">{title}</span>
      {extra}
      {/* visible options trigger (works everywhere, even without long-press) */}
      <span
        role="button"
        aria-label="Chat options"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          longFired.current = true;
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          onMenu(Math.max(8, r.right - 24), r.bottom + 6);
        }}
        className="shrink-0 h-6 w-6 -mr-1 rounded-md flex items-center justify-center text-slate-600 hover:text-white hover:bg-white/10 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
        </svg>
      </span>
      {pinned && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="#d4af37" className="shrink-0" aria-label="pinned">
          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
        </svg>
      )}
      <span className="text-[10px] text-slate-700 shrink-0">{meta}</span>
    </button>
  );
}
