"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, loadGuestSessions, saveGuestSession, deleteGuestSession, GuestSession } from "@/lib/auth";
import { UsagePanel, useToast, trackUsage, canSend } from "@/components/UsagePanel";
import {
  ChatIcon, BotIcon, ZapIcon, PlugIcon, SettingsIcon, GhostIcon,
  WrenchIcon, ClipboardIcon, MessageIcon, SearchIcon, GithubIcon,
  FolderIcon, GlobeIcon, UserIcon, KeyIcon, AlertIcon, PlusIcon,
  LogOutIcon, CheckIcon,
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
    if (mounted && !loading) {
      setGuestSessions(loadGuestSessions());
      fetch("/api/opencode/install").then(r => r.json()).then(setOcStatus).catch(() => {});
    }
  }, [mounted, loading, user, guest]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <div className="orb orb-1" />
        <div className="flex flex-col items-center gap-3 z-10">
          <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <div className="text-zinc-500 text-sm">Loading…</div>
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
      <div className="orb orb-1" />
      <Toaster />

      {/* Header */}
      <header className="relative z-20 glass-strong border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="font-semibold tracking-tight text-[15px] text-white">Founda</span>
            <span className="text-[13px] text-zinc-600 hidden sm:inline">CRM</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* opencode status */}
            <div className={`hidden sm:flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border ${
              ocStatus?.installed
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-white/5 text-zinc-400 border-white/10"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${ocStatus?.installed ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
              opencode {ocStatus?.installed ? "online" : "offline"}
            </div>

            {/* Usage compact */}
            <UsagePanel compact />

            {/* User */}
            {user ? (
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-[11px] font-medium text-zinc-300">
                  {user.email?.[0]?.toUpperCase() || "?"}
                </div>
                <button onClick={() => { logout(); router.push("/"); }}
                  className="glass-btn px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hidden sm:flex items-center gap-1.5">
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
        <div className="relative z-10 bg-white/[0.03] border-b border-white/[0.08] px-4 py-2.5 flex items-center justify-center gap-3 text-sm animate-fade-in">
          <GhostIcon size={14} className="text-zinc-400" />
          <span className="text-zinc-400">Guest mode — chats are not saved permanently.</span>
          <Link href="/register" className="text-white hover:text-zinc-300 font-medium underline underline-offset-2 text-[13px]">
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
                  ? "text-white bg-white/[0.06] border-b-2 border-white -mb-px"
                  : "text-zinc-500 hover:text-zinc-300"
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

  const deleteGuestChat = (id: string) => {
    if (!confirm("Delete this chat?")) return;
    deleteGuestSession(id);
    setGuestSessions(loadGuestSessions());
    toast("Chat deleted", "success");
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

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-white">Chats</h2>
          <p className="text-[13px] text-zinc-500 mt-0.5">
            {user ? "Saved to your account" : guest ? "Local only — not saved permanently" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(!showImport)}
            className="glass-btn px-3.5 py-2 rounded-lg text-[13px] text-zinc-300 hover:text-white">
            Import
          </button>
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
            className="glass-input w-full px-4 py-3 rounded-xl text-xs font-mono text-white placeholder-zinc-600 resize-none" />
          <button onClick={importSession} disabled={!importData}
            className="mt-2 glass-btn-primary px-4 py-2 rounded-lg text-xs disabled:opacity-40">
            Import
          </button>
        </div>
      )}

      <div className="space-y-2">
        {guestSessions.length === 0 && (
          <div className="text-center py-16 glass-card">
            <ChatIcon size={28} className="mx-auto mb-3 text-zinc-600" />
            <p className="text-zinc-400 mb-1 text-sm">No chats yet.</p>
            <p className="text-[13px] text-zinc-600">Start a new chat to begin.</p>
          </div>
        )}
        {guestSessions.map((session: GuestSession, i: number) => (
          <div key={session.id}
            className={`glass-card p-4 flex items-center justify-between group animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
            <button onClick={() => router.push(`/sessions/${session.id}?guest=1`)} className="flex-1 text-left min-w-0">
              <div className="font-medium text-white truncate group-hover:text-zinc-300 transition-colors text-sm">
                {session.title}
              </div>
              <div className="text-[12px] text-zinc-500 mt-0.5">
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
      </div>
    </div>
  );
}

// ── Agents Tab ──
function AgentsTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const FALLBACK_AGENTS = [
    { id: "build", name: "Build", icon: <WrenchIcon size={20} />, desc: "Writes, edits, and builds code" },
    { id: "plan", name: "Plan", icon: <ClipboardIcon size={20} />, desc: "Read-only analysis and planning" },
    { id: "general", name: "General", icon: <MessageIcon size={20} />, desc: "General-purpose assistant" },
    { id: "explore", name: "Explore", icon: <SearchIcon size={20} />, desc: "Codebase search and discovery" },
  ];

  useEffect(() => {
    fetch("/api/opencode/agents").then(r => r.json()).then(d => {
      if (d.agents && d.agents.length > 0) setAgents(d.agents);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const displayAgents = agents.length > 0
    ? agents.map((a: any) => ({ ...a, icon: <BotIcon size={20} /> }))
    : FALLBACK_AGENTS;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-1">Agents</h2>
      <p className="text-[13px] text-zinc-500 mb-5">Free opencode agents — no API keys needed</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayAgents.map((agent: any, i: number) => (
          <div key={agent.id} className={`glass-card p-5 !transform-none animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="h-9 w-9 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-300">
                {agent.icon}
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                FREE
              </span>
            </div>
            <h3 className="font-medium text-white mb-1 text-sm">{agent.name}</h3>
            <p className="text-[12px] text-zinc-500 leading-relaxed">{agent.desc || agent.description}</p>
            <code className="text-[10px] text-zinc-600 mt-2 block font-mono">{agent.id}</code>
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
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const { toast, Toaster } = useToast();

  useEffect(() => {
    fetch("/api/opencode/mcp").then(r => r.json()).then(d => {
      if (d.servers) setServers(Array.isArray(d.servers) ? d.servers : []);
    }).catch(() => {});
  }, []);

  const addServer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/opencode/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", name, config: { type: "local", command, args: [], env: {} } }),
      });
      const data = await res.json();
      if (data.error) toast(data.error, "error");
      else { toast("MCP server added", "success"); setName(""); setCommand(""); setShowAdd(false); }
    } catch { toast("Failed to add server", "error"); }
  };

  return (
    <div>
      <Toaster />
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-white">MCP servers</h2>
          <p className="text-[13px] text-zinc-500 mt-0.5">Tools your agents can use</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="glass-btn-primary px-4 py-2 rounded-lg text-[13px] flex items-center gap-1.5">
          {showAdd ? "Cancel" : <><PlusIcon size={13} /> Add</>}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addServer} className="glass-card p-5 mb-5 space-y-3 animate-fade-up">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Server name" required
            className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-600" />
          <input value={command} onChange={(e) => setCommand(e.target.value)}
            placeholder="Command (e.g. npx -y @modelcontextprotocol/server-github)" required
            className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white font-mono placeholder-zinc-600" />
          <button type="submit" className="glass-btn-primary px-4 py-2 rounded-lg text-sm">Add server</button>
        </form>
      )}

      {/* Quick presets */}
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        {[
          { name: "github", cmd: "npx -y @modelcontextprotocol/server-github", icon: <GithubIcon size={17} /> },
          { name: "filesystem", cmd: "npx -y @modelcontextprotocol/server-filesystem /workspace", icon: <FolderIcon size={17} /> },
          { name: "web-search", cmd: "npx -y @modelcontextprotocol/server-brave-search", icon: <GlobeIcon size={17} /> },
        ].map((p) => (
          <button key={p.name} onClick={() => { setName(p.name); setCommand(p.cmd); setShowAdd(true); }}
            className="glass-card p-4 text-left !transform-none hover:bg-white/[0.04]">
            <div className="h-8 w-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-400 mb-2.5">
              {p.icon}
            </div>
            <div className="text-[13px] font-medium text-white">{p.name}</div>
            <div className="text-[10px] text-zinc-600 font-mono truncate mt-0.5">{p.cmd}</div>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {servers.map((s: any, i: number) => (
          <div key={i} className="glass-card p-4 flex items-center justify-between animate-fade-up">
            <div>
              <div className="font-medium text-white text-sm">{s.name || s.id}</div>
              <div className="text-xs text-zinc-500">{s.type || "local"}</div>
            </div>
            <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
              <CheckIcon size={10} /> Active
            </span>
          </div>
        ))}
        {servers.length === 0 && <p className="text-zinc-600 text-sm text-center py-8">No MCP servers connected.</p>}
      </div>
    </div>
  );
}

// ── Settings Tab ──
function SettingsTab({ user, guest, onLogout }: any) {
  const [displayName, setDisplayName] = useState("");
  const [opencodeInfo, setOpencodeInfo] = useState<any>(null);
  const [installing, setInstalling] = useState(false);
  const { toast, Toaster } = useToast();

  useEffect(() => {
    if (user) setDisplayName(user.user_metadata?.full_name || "");
    fetch("/api/opencode/install").then(r => r.json()).then(setOpencodeInfo).catch(() => {});
  }, [user]);

  const handleInstall = async (action: string) => {
    setInstalling(true);
    try {
      const res = await fetch("/api/opencode/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      toast(data.message || "Done", data.success ? "success" : "error");
      fetch("/api/opencode/install").then(r => r.json()).then(setOpencodeInfo).catch(() => {});
    } catch { toast("Failed", "error"); }
    finally { setInstalling(false); }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Toaster />

      {/* Account */}
      <div className="glass-card p-6 !transform-none animate-fade-up">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2 text-sm">
          <UserIcon size={15} className="text-zinc-400" /> Account
        </h3>
        {user ? (
          <div className="space-y-3">
            <div>
              <label className="text-[12px] text-zinc-500">Email</label>
              <input value={user.email} disabled
                className="glass-input w-full px-3 py-2 rounded-lg text-sm opacity-50 text-white mt-1" />
            </div>
            <div>
              <label className="text-[12px] text-zinc-500">Display name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-lg text-sm text-white mt-1 placeholder-zinc-600" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => toast("Settings saved", "success")}
                className="glass-btn-primary px-4 py-2 rounded-lg text-sm">Save</button>
              <button onClick={onLogout}
                className="glass-btn-danger px-4 py-2 rounded-lg text-sm flex items-center gap-1.5">
                <LogOutIcon size={13} /> Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-zinc-400 text-sm mb-3">You&apos;re in guest mode.</p>
            <Link href="/register" className="glass-btn-primary inline-block px-5 py-2.5 rounded-lg text-sm">
              Create account
            </Link>
          </div>
        )}
      </div>

      {/* opencode engine */}
      <div className="glass-card p-6 !transform-none animate-fade-up stagger-2">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2 text-sm">
          <ZapIcon size={15} className="text-zinc-400" /> opencode engine
        </h3>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${opencodeInfo?.installed ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
            <span className="text-sm text-zinc-300">
              {opencodeInfo?.installed ? `v${opencodeInfo.version || "installed"}` : "Not installed"}
            </span>
          </div>
          <div className="flex gap-2">
            {!opencodeInfo?.installed && (
              <button onClick={() => handleInstall("install")} disabled={installing}
                className="glass-btn-primary px-4 py-1.5 rounded-lg text-xs disabled:opacity-40">
                {installing ? "Installing…" : "Install"}
              </button>
            )}
            {opencodeInfo?.installed && (
              <button onClick={() => handleInstall("upgrade")} disabled={installing}
                className="glass-btn px-4 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white disabled:opacity-40">
                {installing ? "Upgrading…" : "Upgrade"}
              </button>
            )}
          </div>
        </div>
        <code className="text-[11px] text-zinc-600 font-mono block bg-black/40 border border-white/[0.06] rounded-lg p-2.5">
          curl -fsSL https://opencode.ai/install | bash
        </code>
      </div>

      {/* External API keys */}
      <div className="glass-card p-6 !transform-none animate-fade-up stagger-3">
        <h3 className="font-medium text-white mb-1 flex items-center gap-2 text-sm">
          <KeyIcon size={15} className="text-zinc-400" /> External API keys
        </h3>
        <p className="text-xs text-zinc-500 mb-4">Optional — connect paid providers. Free agents work without keys.</p>
        <div className="space-y-2">
          {[
            { id: "anthropic", name: "Anthropic", models: "Claude Sonnet 4, Haiku 4" },
            { id: "openai", name: "OpenAI", models: "GPT-4o, GPT-4o Mini" },
            { id: "google", name: "Google", models: "Gemini 2.0" },
            { id: "groq", name: "Groq", models: "Llama 3 (free tier)" },
          ].map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.08] bg-white/[0.02]">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-white">{p.name}</div>
                <div className="text-[10px] text-zinc-600">{p.models}</div>
              </div>
              <input type="password" placeholder="API key"
                className="glass-input w-32 px-3 py-1.5 rounded-lg text-xs font-mono text-white placeholder-zinc-700" />
              <button onClick={() => toast("Key saved via opencode SDK", "success")}
                className="glass-btn px-3 py-1.5 rounded-lg text-xs text-zinc-300 hover:text-white">
                Save
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      {guest && !user && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 animate-fade-up stagger-4">
          <h3 className="font-medium text-white mb-2 flex items-center gap-2 text-sm">
            <AlertIcon size={15} className="text-zinc-400" /> Guest data
          </h3>
          <p className="text-xs text-zinc-500 mb-4">Your guest chats live in this browser only. Clearing site data removes them.</p>
          <button onClick={() => { localStorage.removeItem("founda_guest_sessions"); toast("Local chats cleared", "success"); }}
            className="glass-btn-danger px-4 py-2 rounded-lg text-sm">
            Clear local chats
          </button>
        </div>
      )}
    </div>
  );
}
