"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, loadGuestSessions, saveGuestSession, deleteGuestSession, GuestSession } from "@/lib/auth";
import { UsagePanel, useToast, trackUsage, canSend } from "@/components/UsagePanel";
import { ready as storeReady, subscribe as storeSubscribe } from "@/lib/store";
import {
  ChatIcon, BotIcon, ZapIcon, PlugIcon, SettingsIcon, GhostIcon,
  WrenchIcon, ClipboardIcon, MessageIcon, SearchIcon, GithubIcon,
  FolderIcon, GlobeIcon, UserIcon, KeyIcon, AlertIcon, PlusIcon,
  LogOutIcon, CheckIcon, TrashIcon, CodeIcon,
} from "@/components/icons";

type Tab = "chats" | "agents" | "usage" | "mcp" | "settings";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "chats", label: "Chats", icon: <ChatIcon size={15} /> },
  { id: "agents", label: "Agents", icon: <BotIcon size={15} /> },
  { id: "usage", label: "Usage", icon: <ZapIcon size={15} /> },
  { id: "mcp", label: "MCP", icon: <PlugIcon size={15} /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon size={15} /> },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, guest, loading, logout, continueAsGuest } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [guestSessions, setGuestSessions] = useState<GuestSession[]>([]);
  const [ocStatus, setOcStatus] = useState<any>(null);
  const { toast, Toaster } = useToast();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !loading && !user && !guest) {
      continueAsGuest();
    }
    if (!mounted || loading) return;
    let unsub: (() => void) | undefined;
    storeReady()
      .then(() => {
        setGuestSessions(loadGuestSessions());
        unsub = storeSubscribe(() => setGuestSessions(loadGuestSessions()));
      })
      .catch(() => setGuestSessions(loadGuestSessions()));
    fetch("/api/opencode/install").then(r => r.json()).then(setOcStatus).catch(() => {});
    return () => { unsub?.(); };
  }, [mounted, loading, user, guest]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="flex flex-col items-center gap-3 z-10">
          <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <div className="text-slate-500 text-sm">Loading…</div>
        </div>
      </div>
    );
  }

  const startQuickChat = () => {
    if (!canSend()) {
      toast("Daily message limit reached. Resets at midnight.", "error");
      return;
    }
    const id = crypto.randomUUID();
    const session: GuestSession = {
      id,
      title: "New chat",
      agent: "build",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    saveGuestSession(session);
    setGuestSessions(loadGuestSessions());
    trackUsage(0, 0);
    router.push(`/sessions/${id}?guest=1`);
  };

  const createAccountSession = async () => {
    if (!user) return;
    try {
      const supabase = (await import("@/lib/supabase-browser")).createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("sessions")
        .insert({
          user_id: user.id,
          title: "New chat",
          agent_name: "build",
          state: { messages: [] },
          message_count: 0,
        })
        .select()
        .single();
      if (error || !data) {
        // Fallback: local session if DB insert fails
        toast("Could not save to cloud — using local session", "info");
        startQuickChat();
        return;
      }
      router.push(`/sessions/${data.id}`);
    } catch {
      startQuickChat();
    }
  };

  const newChat = async () => {
    if (user) await createAccountSession();
    else startQuickChat();
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Toaster />

      {/* Header */}
      <header className="relative z-20 glass-strong hairline-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-semibold tracking-tight text-[15px] gradient-text">Founda</span>
            <span className="text-[13px] text-slate-600 hidden sm:inline">CRM</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* opencode status */}
            <div className={`hidden sm:flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border ${
              ocStatus?.installed
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-white/5 text-slate-400 border-white/10"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${ocStatus?.installed ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
              opencode {ocStatus?.installed ? "online" : "offline"}
            </div>

            {/* Usage compact */}
            <UsagePanel compact />

            {/* User */}
            {user ? (
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-[11px] font-semibold text-white shadow-md shadow-emerald-600/30">
                  {user.email?.[0]?.toUpperCase() || "?"}
                </div>
                <button onClick={() => { logout(); router.push("/"); }}
                  className="glass-btn px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hidden sm:flex items-center gap-1.5">
                  <LogOutIcon size={13} />
                  Sign out
                </button>
              </div>
            ) : (
              <Link href="/register" className="glass-btn-primary px-3.5 py-1.5 rounded-lg text-xs">
                Sign up
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Guest banner */}
      {guest && !user && (
        <div className="relative z-10 bg-gradient-to-r from-emerald-500/[0.08] to-teal-500/[0.05] border-b border-emerald-500/15 px-4 py-2.5 flex items-center justify-center gap-3 text-sm animate-fade-in">
          <GhostIcon size={14} className="text-slate-400" />
          <span className="text-slate-300">Guest mode — chats &amp; settings are saved server-side on this device. Create an account to sync across phones.</span>
          <Link href="/register" className="text-emerald-300 hover:text-emerald-200 font-medium underline underline-offset-2 text-[13px]">
            Create account to save
          </Link>
        </div>
      )}

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="flex items-center gap-0.5 border-b border-white/[0.08] mb-6 overflow-x-auto pb-px">
          {TABS.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-t-lg transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-white bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border-b-2 border-emerald-400 -mb-px shadow-[0_4px_16px_rgba(139,92,246,0.18)]"
                  : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]"
              }`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div key={activeTab} className="tab-enter">
          {activeTab === "chats" && (
            <ChatsTab
              user={user} guest={guest}
              guestSessions={guestSessions}
              setGuestSessions={setGuestSessions}
              onNewChat={newChat}
              toast={toast}
            />
          )}
          {activeTab === "agents" && <AgentsTab />}
          {activeTab === "usage" && (
            <div className="max-w-lg mx-auto">
              <UsagePanel />
            </div>
          )}
          {activeTab === "mcp" && <McpTab />}
          {activeTab === "settings" && <SettingsTab user={user} guest={guest} onLogout={() => { logout(); router.push("/"); }} />}
        </div>
      </div>
    </div>
  );
}

// ── Chats Tab ──
function ChatsTab({ user, guest, guestSessions, setGuestSessions, onNewChat, toast }: any) {
  const router = useRouter();
  const [importData, setImportData] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [accountSessions, setAccountSessions] = useState<any[]>([]);
  const [loadingAcct, setLoadingAcct] = useState(false);

  const loadAccountSessions = async () => {
    if (!user) return;
    setLoadingAcct(true);
    try {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
      const sb = createSupabaseBrowserClient();
      const { data } = await sb
        .from("sessions")
        .select("id, title, agent_name, message_count, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      setAccountSessions(data || []);
    } catch {}
    setLoadingAcct(false);
  };

  useEffect(() => {
    if (user) loadAccountSessions();
  }, [user]);

  const deleteGuestChat = (id: string) => {
    if (!confirm("Delete this chat?")) return;
    deleteGuestSession(id);
    setGuestSessions(loadGuestSessions());
    toast("Chat deleted", "success");
  };

  const deleteAccountChat = async (id: string) => {
    if (!confirm("Delete this chat?")) return;
    try {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
      const sb = createSupabaseBrowserClient();
      await sb.from("sessions").delete().eq("id", id).eq("user_id", user.id);
      loadAccountSessions();
      toast("Chat deleted", "success");
    } catch {
      toast("Could not delete chat", "error");
    }
  };

  const importSession = () => {
    try {
      const parsed = JSON.parse(importData);
      const id = crypto.randomUUID();
      const session: GuestSession = {
        id,
        title: parsed.title || "Imported chat",
        agent: parsed.agent_name || "build",
        messages: parsed.state?.messages || [],
        createdAt: new Date().toISOString(),
      };
      saveGuestSession(session);
      setGuestSessions(loadGuestSessions());
      setImportData("");
      setShowImport(false);
      toast(`Imported ${session.messages.length} messages`, "success");
    } catch {
      toast("Invalid JSON", "error");
    }
  };

  const sessions = user ? null : guestSessions;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Chats</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {user
              ? "Stored server-side in your account — syncs across all devices"
              : guest
                ? "Stored server-side on this device profile — create an account to sync everywhere"
                : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {!user && (
            <button onClick={() => setShowImport(!showImport)}
              className="glass-btn px-3.5 py-2 rounded-lg text-[13px] text-slate-300 hover:text-white">
              Import
            </button>
          )}
          <button onClick={onNewChat} className="glass-btn-primary px-4 py-2 rounded-lg text-[13px] flex items-center gap-1.5">
            <PlusIcon size={14} />
            New chat
          </button>
        </div>
      </div>

      {showImport && (
        <div className="glass-card p-5 mb-5 animate-fade-up">
          <h3 className="text-[13px] font-medium text-white mb-2">Import session JSON</h3>
          <textarea value={importData} onChange={(e) => setImportData(e.target.value)}
            placeholder='{"title": "...", "state": {"messages": [...]}}' rows={4}
            className="glass-input w-full px-4 py-3 rounded-xl text-xs font-mono text-white placeholder-slate-600 resize-none" />
          <button onClick={importSession} disabled={!importData}
            className="mt-2 glass-btn-primary px-4 py-2 rounded-lg text-xs disabled:opacity-40">
            Import
          </button>
        </div>
      )}

      <div className="space-y-2">
        {user ? (
          <>
            {loadingAcct && accountSessions.length === 0 && (
              <div className="text-center py-16 glass-card">
                <div className="h-5 w-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-[13px] text-slate-500">Loading your chats…</p>
              </div>
            )}
            {!loadingAcct && accountSessions.length === 0 && (
              <div className="text-center py-16 glass-card">
                <ChatIcon size={28} className="mx-auto mb-3 text-emerald-400" />
                <p className="text-slate-400 mb-1 text-sm">No chats yet.</p>
                <p className="text-[13px] text-slate-500">Start a new chat to begin.</p>
              </div>
            )}
            {accountSessions.map((s: any, i: number) => (
              <div key={s.id}
                className={`glass-card p-4 flex items-center justify-between group animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
                <button onClick={() => router.push(`/sessions/${s.id}`)} className="flex-1 text-left min-w-0">
                  <div className="font-medium text-white truncate group-hover:text-slate-300 transition-colors text-sm">
                    {s.title || "Untitled chat"}
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5">
                    {s.agent_name} · {s.message_count || 0} messages · {new Date(s.updated_at).toLocaleDateString()}
                  </div>
                </button>
                <div className="flex gap-1.5 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => deleteAccountChat(s.id)}
                    className="glass-btn-danger px-3 py-1.5 rounded-lg text-xs">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            {sessions!.length === 0 && (
              <div className="text-center py-16 glass-card">
                <ChatIcon size={28} className="mx-auto mb-3 text-emerald-400" />
                <p className="text-slate-400 mb-1 text-sm">No chats yet.</p>
                <p className="text-[13px] text-slate-500">Start a new chat to begin.</p>
              </div>
            )}
            {sessions!.map((session: GuestSession, i: number) => (
              <div key={session.id}
                className={`glass-card p-4 flex items-center justify-between group animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
                <button onClick={() => router.push(`/sessions/${session.id}?guest=1`)} className="flex-1 text-left min-w-0">
                  <div className="font-medium text-white truncate group-hover:text-slate-300 transition-colors text-sm">
                    {session.title}
                  </div>
                  <div className="text-[12px] text-slate-500 mt-0.5">
                    {session.agent} · {session.messages.length} messages · {new Date(session.createdAt).toLocaleDateString()}
                  </div>
                </button>
                <div className="flex gap-1.5 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => deleteGuestChat(session.id)}
                    className="glass-btn-danger px-3 py-1.5 rounded-lg text-xs">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Agents Tab ──
function AgentsTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const FALLBACK_AGENTS = [
    { id: "build", name: "Build", icon: <WrenchIcon size={20} />, desc: "Writes, edits, and builds code", grad: "from-emerald-500 to-teal-600" },
    { id: "plan", name: "Plan", icon: <ClipboardIcon size={20} />, desc: "Read-only analysis and planning", grad: "from-amber-500 to-orange-600" },
    { id: "general", name: "General", icon: <MessageIcon size={20} />, desc: "General-purpose assistant", grad: "from-sky-500 to-blue-600" },
    { id: "explore", name: "Explore", icon: <SearchIcon size={20} />, desc: "Codebase search and discovery", grad: "from-violet-500 to-indigo-600" },
  ];

  useEffect(() => {
    fetch("/api/opencode/agents").then(r => r.json()).then(d => {
      if (d.agents && d.agents.length > 0) setAgents(d.agents);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const AGENT_GRADS: Record<string, string> = {
    build: "from-emerald-500 to-teal-600",
    plan: "from-amber-500 to-orange-600",
    general: "from-sky-500 to-blue-600",
    explore: "from-violet-500 to-indigo-600",
  };
  const displayAgents = agents.length > 0
    ? agents.map((a: any) => ({ ...a, icon: <BotIcon size={20} />, grad: AGENT_GRADS[a.id] || "from-emerald-500 to-teal-500" }))
    : FALLBACK_AGENTS;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-1">Agents</h2>
      <p className="text-[13px] text-slate-500 mb-5">Free opencode agents — no API keys needed</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayAgents.map((agent: any, i: number) => (
          <div key={agent.id} className={`glass-card p-5 !transform-none animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${agent.grad} flex items-center justify-center text-white shadow-md`}>
                {agent.icon}
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                FREE
              </span>
            </div>
            <h3 className="font-medium text-white mb-1 text-sm">{agent.name}</h3>
            <p className="text-[12px] text-slate-500 leading-relaxed">{agent.desc || agent.description}</p>
            <code className="text-[10px] text-slate-600 mt-2 block font-mono">{agent.id}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MCP Tab ──
function McpTab() {
  const [servers, setServers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [mode, setMode] = useState<"url" | "command">("url");
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast, Toaster } = useToast();

  const refresh = () =>
    fetch("/api/opencode/mcp")
      .then((r) => r.json())
      .then((d) => { if (d.servers) setServers(Array.isArray(d.servers) ? d.servers : []); })
      .catch(() => {});
  useEffect(() => { refresh(); }, []);

  const addServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let config: any;
      let label: string;
      if (mode === "url") {
        let hdrs: Record<string, string> | undefined;
        if (headers.trim()) {
          try {
            hdrs = JSON.parse(headers);
          } catch {
            toast("Headers must be valid JSON", "error");
            setBusy(false);
            return;
          }
        }
        const derived = name.trim() || new URL(url).hostname;
        label = derived;
        config = { type: "remote", url: url.trim(), ...(hdrs ? { headers: hdrs } : {}) };
      } else {
        label = name.trim();
        config = { type: "local", command, args: [], env: {} };
      }
      const res = await fetch("/api/opencode/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", name: label, config }),
      });
      const data = await res.json();
      if (data.error) toast(data.error, "error");
      else {
        toast(`Connected: ${label}`, "success");
        setName(""); setUrl(""); setHeaders(""); setCommand(""); setShowAdd(false);
        setTimeout(refresh, 600);
      }
    } catch { toast("Failed to add server", "error"); }
    finally { setBusy(false); }
  };

  const disconnect = async (n: string) => {
    try {
      const res = await fetch("/api/opencode/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", name: n }),
      });
      const data = await res.json();
      if (data.error) toast(data.error, "error");
      else { toast(`Disconnected: ${n}`, "success"); setTimeout(refresh, 400); }
    } catch { toast("Disconnect failed", "error"); }
  };

  return (
    <div>
      <Toaster />
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-white">MCP servers</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">Connect via URL (remote) or command (local)</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="glass-btn-primary px-4 py-2 rounded-lg text-[13px] flex items-center gap-1.5">
          {showAdd ? "Cancel" : <><PlusIcon size={13} /> Add</>}
        </button>
      </div>

      {showAdd && (
        <div className="glass-card p-5 mb-5 space-y-3 animate-fade-up">
          <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 w-fit">
            {(["url", "command"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded-lg text-[12.5px] transition-colors ${mode === m ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30" : "text-slate-500 border border-transparent"}`}>
                {m === "url" ? "Link (URL)" : "Command"}
              </button>
            ))}
          </div>

          <form onSubmit={addServer} className="space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder={mode === "url" ? "Name (optional — derived from URL)" : "Server name"}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-slate-600" />

            {mode === "url" ? (
              <>
                <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" required
                  placeholder="https://mcp.context7.com/mcp"
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white font-mono placeholder-slate-600" />
                <textarea value={headers} onChange={(e) => setHeaders(e.target.value)} rows={2}
                  placeholder={'Optional headers JSON: {"Authorization": "Bearer …"}'}
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-[12.5px] text-white font-mono placeholder-slate-600 resize-none" />
              </>
            ) : (
              <input value={command} onChange={(e) => setCommand(e.target.value)}
                placeholder="Command (e.g. npx -y @modelcontextprotocol/server-github)" required
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white font-mono placeholder-slate-600" />
            )}

            <button type="submit" disabled={busy}
              className="glass-btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {busy ? "Connecting…" : "Connect"}
            </button>
          </form>
        </div>
      )}

      {/* Remote presets */}
      <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">Remote presets (URL)</div>
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        {[
          { name: "context7", url: "https://mcp.context7.com/mcp", icon: <GlobeIcon size={17} />, desc: "Library docs" },
          { name: "deepwiki", url: "https://mcp.deepwiki.com/mcp", icon: <CodeIcon size={17} />, desc: "Repo wiki Q&A" },
          { name: "generic-url", url: "", icon: <PlugIcon size={17} />, desc: "Any MCP endpoint" },
        ].map((p) => (
          <button key={p.name}
            onClick={() => { setMode("url"); setName(p.name === "generic-url" ? "" : p.name); setUrl(p.url); setShowAdd(true); }}
            className="glass-card p-4 text-left !transform-none hover:bg-white/[0.04]">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/70 to-teal-500/70 border border-white/10 flex items-center justify-center text-white mb-2.5 shadow-md">
              {p.icon}
            </div>
            <div className="text-[13px] font-medium text-white">{p.name}</div>
            <div className="text-[10px] text-slate-500 font-mono truncate mt-0.5">{p.url || p.desc}</div>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {servers.map((s: any, i: number) => (
          <div key={i} className="glass-card p-4 flex items-center justify-between animate-fade-up">
            <div className="min-w-0">
              <div className="font-medium text-white text-sm truncate">{s.name || s.id}</div>
              <div className="text-xs text-slate-500 font-mono truncate">
                {s.config?.type === "remote" || s.type === "remote" ? (s.config?.url || s.url || "remote") : (s.config?.command || s.command || s.type || "local")}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                <CheckIcon size={10} /> {s.status || "Active"}
              </span>
              <button onClick={() => disconnect(s.name || s.id)}
                className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Disconnect">
                <TrashIcon size={13} />
              </button>
            </div>
          </div>
        ))}
        {servers.length === 0 && <p className="text-slate-600 text-sm text-center py-8">No MCP servers connected.</p>}
      </div>
    </div>
  );
}

// ── Settings Tab ──
function SettingsTab({ user, guest, onLogout }: any) {
  const [displayName, setDisplayName] = useState("");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const { toast, Toaster } = useToast();

  useEffect(() => {
    if (user) setDisplayName(user.user_metadata?.full_name || "");
    let unsub: (() => void) | undefined;
    import("@/lib/store")
      .then(async (store) => {
        await store.ready();
        setApiKeys({ ...store.getApiKeys() });
        unsub = store.subscribe(() => setApiKeys({ ...store.getApiKeys() }));
      })
      .catch(() => {});
    return () => unsub?.();
  }, [user]);

  const saveKey = async (provider: string) => {
    setSavingKeys((s) => ({ ...s, [provider]: true }));
    try {
      const store = await import("@/lib/store");
      store.saveApiKey(provider, apiKeys[provider] || "");
      await store.ready();
      toast(user ? "Key saved to your account" : "Key saved to this device profile", "success");
    } catch {
      toast("Could not save key", "error");
    }
    setSavingKeys((s) => ({ ...s, [provider]: false }));
  };

  const saveProfile = async () => {
    if (!user) return;
    try {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
      const sb = createSupabaseBrowserClient();
      const { error } = await sb
        .from("profiles")
        .upsert({ id: user.id, display_name: displayName, updated_at: new Date().toISOString() });
      toast(error ? error.message : "Profile saved to your account", error ? "error" : "success");
    } catch {
      toast("Could not save profile", "error");
    }
  };

  const clearGuestData = async () => {
    if (!confirm("Delete all your saved chats and settings from the server?")) return;
    try {
      const store = await import("@/lib/store");
      store.clearAllStoreData();
      toast("Server data cleared", "success");
    } catch {
      toast("Could not clear data", "error");
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Toaster />

      {/* Account */}
      <div className="glass-card p-6 !transform-none animate-fade-up">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2 text-sm">
          <UserIcon size={15} className="text-emerald-400" /> Account
        </h3>
        {user ? (
          <div className="space-y-3">
            <div>
              <label className="text-[12px] text-slate-500">Email</label>
              <input value={user.email} disabled
                className="glass-input w-full px-3 py-2 rounded-lg text-sm opacity-50 text-white mt-1" />
            </div>
            <div>
              <label className="text-[12px] text-slate-500">Display name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-lg text-sm text-white mt-1 placeholder-slate-600" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveProfile}
                className="glass-btn-primary px-4 py-2 rounded-lg text-sm">Save</button>
              <button onClick={onLogout}
                className="glass-btn-danger px-4 py-2 rounded-lg text-sm flex items-center gap-1.5">
                <LogOutIcon size={13} /> Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-slate-400 text-sm mb-3">You&apos;re in guest mode.</p>
            <Link href="/register" className="glass-btn-primary inline-block px-5 py-2.5 rounded-lg text-sm">
              Create account
            </Link>
          </div>
        )}
      </div>

      {/* External API keys */}
      <div className="glass-card p-6 !transform-none animate-fade-up stagger-3">
        <h3 className="font-medium text-white mb-1 flex items-center gap-2 text-sm">
          <KeyIcon size={15} className="text-amber-400" /> External API keys
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Stored server-side in your profile — synced across every device you sign in on.
        </p>
        <div className="space-y-2">
          {[
            { id: "anthropic", name: "Anthropic", models: "Claude Sonnet 4, Haiku 4" },
            { id: "openai", name: "OpenAI", models: "GPT-4o, GPT-4o Mini" },
            { id: "google", name: "Google", models: "Gemini 2.0" },
            { id: "groq", name: "Groq", models: "Llama 3 (free tier)" },
          ].map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-white flex items-center gap-2">
                  {p.name}
                  {apiKeys[p.id] && <CheckIcon size={12} className="text-emerald-400" />}
                </div>
                <div className="text-[10px] text-slate-600">{p.models}</div>
              </div>
              <input type="password" placeholder="API key" value={apiKeys[p.id] || ""}
                onChange={(e) => setApiKeys((k) => ({ ...k, [p.id]: e.target.value }))}
                className="glass-input w-32 px-3 py-1.5 rounded-lg text-xs font-mono text-white placeholder-slate-700" />
              <button onClick={() => saveKey(p.id)} disabled={savingKeys[p.id]}
                className="glass-btn px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white disabled:opacity-40">
                {savingKeys[p.id] ? "Saving…" : "Save"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      {guest && !user && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-6 animate-fade-up stagger-4">
          <h3 className="font-medium text-white mb-2 flex items-center gap-2 text-sm">
            <AlertIcon size={15} className="text-amber-400" /> Guest data
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Your chats and keys live in a server-side guest profile for this device. Creating an account migrates them permanently.
          </p>
          <button onClick={clearGuestData}
            className="glass-btn-danger px-4 py-2 rounded-lg text-sm">
            Delete server data for this device
          </button>
        </div>
      )}
    </div>
  );
}
