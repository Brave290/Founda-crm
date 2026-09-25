"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, loadGuestSessions, GuestSession } from "@/lib/auth";
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

  const isGuestNav = !user;

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
    let unsub: (() => void) | undefined;
    import("@/lib/store").then((st) => {
      unsub = st.subscribe(() => refresh());
    }).catch(() => {});
    return () => unsub?.();
  }, [user]);

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

  const newChat = () => go(`/sessions/${crypto.randomUUID()}${isGuestNav ? "?guest=1" : ""}`);

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

          {acctItems.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-slate-600">
                Your chats
              </div>
              {acctItems.map((s) => (
                <HistoryItem
                  key={s.id}
                  active={s.id === currentId}
                  title={s.title || "Untitled chat"}
                  meta={new Date(s.updated_at).toLocaleDateString()}
                  onClick={() => go(`/sessions/${s.id}`)}
                />
              ))}
            </>
          )}

          {guestItems.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-slate-600">
                {user ? "This device" : "Recent"}
              </div>
              {guestItems.map((s) => (
                <HistoryItem
                  key={s.id}
                  active={s.id === currentId}
                  title={s.title || "Untitled chat"}
                  meta={new Date(s.createdAt).toLocaleDateString()}
                  onClick={() => go(`/sessions/${s.id}${user ? "" : "?guest=1"}`)}
                />
              ))}
            </>
          )}
        </nav>

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
  onClick,
}: {
  title: string;
  meta: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 transition-colors ${
        active ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
      }`}
      title={title}
    >
      <MessageIcon size={14} className="shrink-0 text-slate-600" />
      <span className="flex-1 min-w-0 truncate text-[13px]">{title}</span>
      <span className="text-[10px] text-slate-700 shrink-0">{meta}</span>
    </button>
  );
}
