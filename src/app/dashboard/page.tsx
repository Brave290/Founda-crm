"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, loadGuestSessions, saveGuestSession, deleteGuestSession, GuestSession } from "@/lib/auth";
import { UsagePanel, useToast, trackUsage, canSend, loadUsage } from "@/components/UsagePanel";

type Tab = "chats" | "agents" | "usage" | "mcp" | "settings";

export default function DashboardPage() {
  const router = useRouter();
  const { user, guest, loading, logout, continueAsGuest } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("chats");
  const [guestSessions, setGuestSessions] = useState<GuestSession[]>([]);
  const [ocStatus, setOcStatus] = useState<any>(null);
  const [showStats, setShowStats] = useState(false);
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
          <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "chats", label: "Chats", icon: "💬" },
    { id: "agents", label: "Agents", icon: "🤖" },
    { id: "usage", label: "Usage", icon: "⚡" },
    { id: "mcp", label: "MCP", icon: "🔧" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  const startQuickChat = () => {
    if (!canSend()) {
      toast("Daily message limit reached. Resets at midnight.", "error");
      return;
    }
    const id = crypto.randomUUID();
    const session: GuestSession = {
      id,
      title: "New Chat",
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
    const supabase = (await import("@/lib/supabase-browser")).createSupabaseBrowserClient();
    const { data } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        title: "New Chat",
        agent_name: "build",
        state: { messages: [] },
        message_count: 0,
      })
      .select()
      .single();
    if (data) router.push(`/sessions/${data.id}`);
  };

  const newChat = async () => {
    if (user) await createAccountSession();
    else startQuickChat();
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <Toaster />

      {/* Header */}
      <header className="relative z-20 glass-strong border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <Link href={user || guest ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-sm shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow">
              F
            </div>
            <span className="font-semibold tracking-tight hidden sm:block">Founda CRM</span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* opencode status */}
            <div className={`hidden sm:flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border ${
              ocStatus?.installed
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${ocStatus?.installed ? "bg-emerald-400 animate-pulse" : "bg-yellow-400"}`} />
              opencode {ocStatus?.installed ? "online" : "offline"}
            </div>

            {/* Usage compact */}
            <UsagePanel compact />

            {/* User */}
            {user ? (
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-xs font-bold">
                  {user.email?.[0]?.toUpperCase() || "?"}
                </div>
                <button onClick={() => { logout(); router.push("/"); }}
                  className="glass-btn px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hidden sm:block">
                  Sign out
                </button>
              </div>
            ) : (
              <Link href="/register" className="glass-btn-primary px-3 py-1.5 rounded-lg text-xs font-medium text-white">
                Sign Up
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Guest banner */}
      {guest && !user && (
        <div className="relative z-10 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-cyan-500/10 border-b border-indigo-500/20 px-4 py-2.5 flex items-center justify-center gap-3 text-sm animate-fade-in">
          <span className="text-indigo-300">👻 Guest mode — chats are not saved permanently.</span>
          <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2">
            Create account to save
          </Link>
        </div>
      )}

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-5">
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-white/5 mb-6 overflow-x-auto pb-px">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-xl transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "text-white bg-white/5 border-b-2 border-indigo-500"
                  : "text-gray-500 hover:text-gray-300"
              }`}>
              <span>{tab.icon}</span>
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
        title: parsed.title || "Imported Chat",
        agent: parsed.agent_name || "build",
        messages: parsed.state?.messages || [],
        createdAt: new Date().toISOString(),
      };
      saveGuestSession(session);
      setGuestSessions(loadGuestSessions());
      setImportData("");
      setShowImport(false);
      toast(`Imported ${session.messages.length} messages!`, "success");
    } catch {
      toast("Invalid JSON", "error");
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Chats</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {user ? "Saved to your account" : guest ? "Local only — not saved permanently" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(!showImport)}
            className="glass-btn px-4 py-2 rounded-xl text-sm text-gray-300">
            Import
          </button>
          <button onClick={onNewChat} className="glass-btn-primary px-4 py-2 rounded-xl text-sm font-medium text-white">
            + New Chat
          </button>
        </div>
      </div>

      {showImport && (
        <div className="glass-card p-5 mb-5 animate-fade-up">
          <h3 className="text-sm font-medium text-white mb-2">Import session JSON</h3>
          <textarea value={importData} onChange={(e) => setImportData(e.target.value)}
            placeholder='{"title": "...", "state": {"messages": [...]}}' rows={4}
            className="glass-input w-full px-4 py-3 rounded-xl text-xs font-mono text-white placeholder-gray-600" />
          <button onClick={importSession} disabled={!importData}
            className="mt-2 glass-btn-primary px-4 py-2 rounded-lg text-xs text-white disabled:opacity-50">
            Import
          </button>
        </div>
      )}

      <div className="space-y-2">
        {guestSessions.length === 0 && (
          <div className="text-center py-16 glass-card">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-gray-500 mb-1">No chats yet.</p>
            <p className="text-sm text-gray-600">Start a new chat to begin.</p>
          </div>
        )}
        {guestSessions.map((session: GuestSession, i: number) => (
          <div key={session.id}
            className={`glass-card p-4 flex items-center justify-between group animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
            <button onClick={() => router.push(`/sessions/${session.id}?guest=1`)} className="flex-1 text-left min-w-0">
              <div className="font-medium text-white truncate group-hover:text-indigo-400 transition-colors">
                {session.title}
              </div>
              <div className="text-sm text-gray-500">
                {session.agent} · {session.messages.length} messages · {new Date(session.createdAt).toLocaleDateString()}
              </div>
            </button>
            <div className="flex gap-1.5 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => deleteGuestChat(session.id)}
                className="glass-btn-danger px-3 py-1.5 rounded-lg text-xs text-red-400">
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

  const FREE_AGENTS = [
    { id: "build", name: "Build", icon: "🔧", desc: "Writes, edits, and builds code" },
    { id: "plan", name: "Plan", icon: "📋", desc: "Read-only analysis and planning" },
    { id: "general", name: "General", icon: "💬", desc: "General-purpose assistant" },
    { id: "explore", name: "Explore", icon: "🔍", desc: "Codebase search and discovery" },
  ];

  useEffect(() => {
    fetch("/api/opencode/agents").then(r => r.json()).then(d => {
      if (d.agents && d.agents.length > 0) setAgents(d.agents);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-1">Agents</h2>
      <p className="text-sm text-gray-500 mb-5">Free opencode agents — no API keys needed</p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(agents.length > 0 ? agents : FREE_AGENTS).map((agent: any, i: number) => (
          <div key={agent.id} className={`glass-card p-5 animate-fade-up stagger-${i + 1} group cursor-default`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{agent.icon || "🤖"}</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                FREE
              </span>
            </div>
            <h3 className="font-semibold text-white mb-1">{agent.name}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{agent.desc || agent.description}</p>
            <code className="text-[10px] text-gray-600 mt-2 block font-mono">{agent.id}</code>
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
      else { toast("MCP server added!", "success"); setName(""); setCommand(""); setShowAdd(false); }
    } catch { toast("Failed to add server", "error"); }
  };

  return (
    <div>
      <Toaster />
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-semibold text-white">MCP Servers</h2>
          <p className="text-sm text-gray-500 mt-0.5">Tools your agents can use</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="glass-btn-primary px-4 py-2 rounded-xl text-sm text-white">
          {showAdd ? "Cancel" : "+ Add"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addServer} className="glass-card p-5 mb-5 space-y-3 animate-fade-up">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Server name" required
            className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white" />
          <input value={command} onChange={(e) => setCommand(e.target.value)}
            placeholder="Command (e.g. npx -y @modelcontextprotocol/server-github)" required
            className="glass-input w-full px-4 py-3 rounded-xl text-sm text-white font-mono" />
          <button type="submit" className="glass-btn-primary px-4 py-2 rounded-lg text-sm text-white">Add Server</button>
        </form>
      )}

      {/* Quick presets */}
      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        {[
          { name: "github", cmd: "npx -y @modelcontextprotocol/server-github", icon: "🐙" },
          { name: "filesystem", cmd: "npx -y @modelcontextprotocol/server-filesystem /public", icon: "📁" },
          { name: "web-search", cmd: "npx -y @modelcontextprotocol/server-brave-search", icon: "🔍" },
        ].map((p) => (
          <button key={p.name} onClick={() => { setName(p.name); setCommand(p.cmd); setShowAdd(true); }}
            className="glass-card p-4 text-left group">
            <div className="text-xl mb-1">{p.icon}</div>
            <div className="text-sm font-medium text-white group-hover:text-indigo-400 transition-colors">{p.name}</div>
            <div className="text-[10px] text-gray-600 font-mono truncate">{p.cmd}</div>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {servers.map((s: any, i: number) => (
          <div key={i} className="glass-card p-4 flex items-center justify-between animate-fade-up">
            <div>
              <div className="font-medium text-white text-sm">{s.name || s.id}</div>
              <div className="text-xs text-gray-500">{s.type || "local"}</div>
            </div>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">Active</span>
          </div>
        ))}
        {servers.length === 0 && <p className="text-gray-600 text-sm text-center py-8">No MCP servers connected.</p>}
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
    <div className="max-w-lg mx-auto space-y-5">
      <Toaster />

      {/* Account */}
      <div className="glass-card p-6 animate-fade-up">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">👤 Account</h3>
        {user ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400">Email</label>
              <input value={user.email} disabled
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm opacity-50 text-white mt-1" />
            </div>
            <div>
              <label className="text-sm text-gray-400">Display Name</label>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white mt-1" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => toast("Settings saved!", "success")}
                className="glass-btn-primary px-4 py-2 rounded-lg text-sm text-white">Save</button>
              <button onClick={onLogout}
                className="glass-btn-danger px-4 py-2 rounded-lg text-sm text-red-400">Sign out</button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm mb-3">You&apos;re in guest mode.</p>
            <Link href="/register" className="glass-btn-primary inline-block px-5 py-2.5 rounded-xl text-sm text-white font-medium">
              Create Account
            </Link>
          </div>
        )}
      </div>

      {/* opencode engine */}
      <div className="glass-card p-6 animate-fade-up stagger-2">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">⚙️ opencode Engine</h3>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${opencodeInfo?.installed ? "bg-emerald-400 animate-pulse" : "bg-yellow-400"}`} />
            <span className="text-sm text-gray-300">
              {opencodeInfo?.installed ? `v${opencodeInfo.version || "installed"}` : "Not installed"}
            </span>
          </div>
          <div className="flex gap-2">
            {!opencodeInfo?.installed && (
              <button onClick={() => handleInstall("install")} disabled={installing}
                className="glass-btn-primary px-4 py-2 rounded-lg text-xs text-white disabled:opacity-50">
                {installing ? "Installing..." : "Install"}
              </button>
            )}
            {opencodeInfo?.installed && (
              <button onClick={() => handleInstall("upgrade")} disabled={installing}
                className="glass-btn px-4 py-2 rounded-lg text-xs text-gray-300 disabled:opacity-50">
                {installing ? "Upgrading..." : "Upgrade"}
              </button>
            )}
          </div>
        </div>
        <code className="text-[10px] text-gray-600 font-mono block bg-gray-800/50 rounded-lg p-2">
          curl -fsSL https://opencode.ai/install | bash
        </code>
      </div>

      {/* External API keys */}
      <div className="glass-card p-6 animate-fade-up stagger-3">
        <h3 className="font-semibold text-white mb-1 flex items-center gap-2">🔑 External API Keys</h3>
        <p className="text-xs text-gray-500 mb-4">Optional — connect paid providers. Free agents work without keys.</p>
        <div className="space-y-2">
          {[
            { id: "anthropic", name: "Anthropic", models: "Claude Sonnet 4, Haiku 4" },
            { id: "openai", name: "OpenAI", models: "GPT-4o, GPT-4o Mini" },
            { id: "google", name: "Google", models: "Gemini 2.0" },
            { id: "groq", name: "Groq", models: "Llama 3 (free tier)" },
          ].map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 glass rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{p.name}</div>
                <div className="text-[10px] text-gray-500">{p.models}</div>
              </div>
              <input type="password" placeholder="API key"
                className="glass-input w-36 px-3 py-1.5 rounded-lg text-xs font-mono text-white" />
              <button onClick={() => toast("Key saved via opencode SDK", "success")}
                className="glass-btn px-3 py-1.5 rounded-lg text-xs text-gray-300">
                Save
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}