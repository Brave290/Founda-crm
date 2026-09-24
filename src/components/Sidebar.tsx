"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Logo, ChatIcon, BotIcon, ZapIcon, SettingsIcon, PlugIcon,
  KeyIcon, SearchIcon, CodeIcon, DatabaseIcon, FolderIcon,
  ArrowLeftIcon, XIcon, ChevronDownIcon, CheckIcon, TrashIcon,
  ExternalLinkIcon, GlobeIcon, ShieldIcon, SparklesIcon,
  WrenchIcon, MessageIcon, ClockIcon, LockIcon, DownloadIcon,
} from "@/components/icons";
import { loadGuestSessions, GuestSession, useAuth } from "@/lib/auth";
import { UsagePanel, useToast } from "@/components/UsagePanel";

type DrawerTab = "history" | "agents" | "skills" | "mcp" | "settings" | "keys" | "autonomous";

// ── opencode-compatible MCP apps list ──
const COMPATIBLE_APPS = [
  { name: "GitHub", category: "Version Control", cmd: "npx -y @modelcontextprotocol/server-github", icon: "gh", connected: false },
  { name: "Filesystem", category: "Files", cmd: "npx -y @modelcontextprotocol/server-filesystem", icon: "fs", connected: false },
  { name: "Brave Search", category: "Web", cmd: "npx -y @modelcontextprotocol/server-brave-search", icon: "bs", connected: false },
  { name: "Google Drive", category: "Cloud", cmd: "npx -y @modelcontextprotocol/server-gdrive", icon: "gd", connected: false },
  { name: "Slack", category: "Communication", cmd: "npx -y @modelcontextprotocol/server-slack", icon: "sl", connected: false },
  { name: "PostgreSQL", category: "Database", cmd: "npx -y @modelcontextprotocol/server-postgres", icon: "pg", connected: false },
  { name: "SQLite", category: "Database", cmd: "npx -y @modelcontextprotocol/server-sqlite", icon: "sq", connected: false },
  { name: "Puppeteer", category: "Browser", cmd: "npx -y @modelcontextprotocol/server-puppeteer", icon: "pp", connected: false },
  { name: "Fetch", category: "Web", cmd: "npx -y @modelcontextprotocol/server-fetch", icon: "fe", connected: false },
  { name: "Memory", category: "Knowledge", cmd: "npx -y @modelcontextprotocol/server-memory", icon: "me", connected: false },
  { name: "Sequential Thinking", category: "Reasoning", cmd: "npx -y @modelcontextprotocol/server-sequential-thinking", icon: "st", connected: false },
  { name: "Firebase", category: "Cloud", cmd: "npx -y @modelcontextprotocol/server-firebase", icon: "fb", connected: false },
  { name: "Supabase", category: "Database", cmd: "npx -y @modelcontextprotocol/server-supabase", icon: "sb", connected: false },
  { name: "Notion", category: "Productivity", cmd: "npx -y @modelcontextprotocol/server-notion", icon: "nt", connected: false },
  { name: "Linear", category: "Project Mgmt", cmd: "npx -y @modelcontextprotocol/server-linear", icon: "ln", connected: false },
  { name: "Sentry", category: "Monitoring", cmd: "npx -y @modelcontextprotocol/server-sentry", icon: "sy", connected: false },
  { name: "AWS S3", category: "Cloud", cmd: "npx -y @modelcontextprotocol/server-aws-s3", icon: "s3", connected: false },
  { name: "Docker", category: "DevOps", cmd: "npx -y @modelcontextprotocol/server-docker", icon: "dk", connected: false },
  { name: "Git", category: "Version Control", cmd: "npx -y @modelcontextprotocol/server-git", icon: "gt", connected: false },
  { name: "Time", category: "Utility", cmd: "npx -y @modelcontextprotocol/server-time", icon: "tm", connected: false },
];

// ── Skills list ──
const SKILLS = [
  { id: "code-review", name: "Code Review", desc: "Automated PR reviews with suggestions", enabled: true },
  { id: "auto-test", name: "Auto Test", desc: "Generate and run tests automatically", enabled: true },
  { id: "refactor", name: "Refactor", desc: "Smart code refactoring suggestions", enabled: false },
  { id: "docs-gen", name: "Docs Generator", desc: "Auto-generate documentation", enabled: false },
  { id: "security-audit", name: "Security Audit", desc: "Scan for vulnerabilities", enabled: false },
  { id: "commit-msg", name: "Commit Messages", desc: "Generate conventional commit messages", enabled: true },
  { id: "web-search", name: "Web Search", desc: "Search the web for references", enabled: false },
  { id: "image-gen", name: "Image Analysis", desc: "Analyze uploaded images", enabled: true },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, guest, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<DrawerTab>("history");
  const [sessions, setSessions] = useState<GuestSession[]>([]);
  const [mcpServers, setMcpServers] = useState<string[]>([]);
  const [skills, setSkills] = useState(SKILLS);
  const [autonomous, setAutonomous] = useState(false);
  const [autonomousTask, setAutonomousTask] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [showAddMcp, setShowAddMcp] = useState(false);
  const [mcpFilter, setMcpFilter] = useState("");
  const { toast, Toaster } = useToast();

  useEffect(() => {
    setSessions(loadGuestSessions());
    // Load saved autonomous state
    try {
      const saved = localStorage.getItem("founda_autonomous");
      if (saved) {
        const data = JSON.parse(saved);
        setAutonomous(data.enabled || false);
        setAutonomousTask(data.task || "");
        setRepoUrl(data.repo || "");
      }
    } catch {}
  }, []);

  const toggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const connectMcp = (name: string) => {
    setMcpServers((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
    toast(
      mcpServers.includes(name) ? `${name} disconnected` : `${name} connected`,
      mcpServers.includes(name) ? "info" : "success"
    );
  };

  const toggleAutonomous = async () => {
    const next = !autonomous;
    setAutonomous(next);
    localStorage.setItem(
      "founda_autonomous",
      JSON.stringify({ enabled: next, task: autonomousTask, repo: repoUrl })
    );
    if (next) {
      toast("Autonomous mode enabled — agent works on server independently", "success");
      // Start autonomous task on server
      try {
        await fetch("/api/autonomous", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "start",
            task: autonomousTask,
            repo: repoUrl,
          }),
        });
      } catch {}
    } else {
      toast("Autonomous mode disabled", "info");
      try {
        await fetch("/api/autonomous", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "stop" }),
        });
      } catch {}
    }
  };

  const deleteSession = (id: string) => {
    const updated = sessions.filter((s) => s.id !== id);
    localStorage.setItem("founda_guest_sessions", JSON.stringify(updated));
    setSessions(updated);
    toast("Chat deleted", "success");
  };

  const tabs: { id: DrawerTab; label: string; icon: React.ReactNode }[] = [
    { id: "history", label: "History", icon: <ClockIcon size={16} /> },
    { id: "agents", label: "Agents", icon: <BotIcon size={16} /> },
    { id: "skills", label: "Skills", icon: <SparklesIcon size={16} /> },
    { id: "mcp", label: "MCP Connectors", icon: <PlugIcon size={16} /> },
    { id: "autonomous", label: "Autonomous", icon: <ZapIcon size={16} /> },
    { id: "keys", label: "API Keys", icon: <KeyIcon size={16} /> },
    { id: "settings", label: "Settings", icon: <SettingsIcon size={16} /> },
  ];

  const filteredApps = COMPATIBLE_APPS.filter(
    (a) =>
      a.name.toLowerCase().includes(mcpFilter.toLowerCase()) ||
      a.category.toLowerCase().includes(mcpFilter.toLowerCase())
  );

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 h-full w-80 sm:w-96 z-50 transform transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full glass-strong border-r border-white/5 flex flex-col overflow-hidden">
          <Toaster />

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <Logo size={28} />
              <div>
                <div className="font-semibold text-sm text-white">
                  {user ? user.email?.split("@")[0] : "Guest"}
                </div>
                <div className="text-[10px] text-gray-500">
                  {user ? "Account connected" : "Local only — not saved"}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="glass-btn p-2 rounded-lg text-gray-400 hover:text-white"
            >
              <XIcon size={16} />
            </button>
          </div>

          {/* Tab pills */}
          <div className="px-3 py-2 border-b border-white/5 overflow-x-auto">
            <div className="flex gap-1.5 min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      : "text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* ── History ── */}
            {activeTab === "history" && (
              <div className="space-y-2 animate-fade-in">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                  Recent Chats
                </div>
                {sessions.length === 0 && (
                  <div className="text-center py-8 glass-card">
                    <ClockIcon size={24} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-sm text-gray-500">No chat history yet.</p>
                  </div>
                )}
                {sessions.map((s, i) => (
                  <div
                    key={s.id}
                    className={`glass-card p-3 flex items-center justify-between group animate-fade-up stagger-${Math.min(i + 1, 6)}`}
                  >
                    <button
                      onClick={() => {
                        router.push(`/sessions/${s.id}?guest=1`);
                        onClose();
                      }}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="text-sm text-white truncate group-hover:text-indigo-400 transition-colors">
                        {s.title}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {s.agent} · {s.messages.length} msgs ·{" "}
                        {new Date(s.createdAt).toLocaleDateString()}
                      </div>
                    </button>
                    <button
                      onClick={() => deleteSession(s.id)}
                      className="glass-btn-danger p-1.5 rounded-lg text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Agents ── */}
            {activeTab === "agents" && (
              <div className="space-y-2 animate-fade-in">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                  Free opencode Agents
                </div>
                {[
                  { id: "build", name: "Build", desc: "Writes, edits, builds code", icon: <WrenchIcon size={16} /> },
                  { id: "plan", name: "Plan", desc: "Read-only analysis & planning", icon: <ClipboardIconSmall /> },
                  { id: "general", name: "General", desc: "General-purpose assistant", icon: <MessageIcon size={16} /> },
                  { id: "explore", name: "Explore", desc: "Codebase search & discovery", icon: <SearchIcon size={16} /> },
                ].map((a) => (
                  <div key={a.id} className="glass-card p-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-400">
                      {a.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{a.name}</span>
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                          FREE
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500">{a.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Skills ── */}
            {activeTab === "skills" && (
              <div className="space-y-2 animate-fade-in">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                  Agent Skills
                </div>
                {skills.map((skill) => (
                  <div key={skill.id} className="glass-card p-3 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-white">{skill.name}</div>
                      <div className="text-[10px] text-gray-500">{skill.desc}</div>
                    </div>
                    <button
                      onClick={() => toggleSkill(skill.id)}
                      className={`relative h-5 w-9 rounded-full transition-colors ${
                        skill.enabled ? "bg-indigo-500" : "bg-gray-700"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          skill.enabled ? "translate-x-4.5 left-0.5" : "left-0.5"
                        }`}
                        style={{
                          transform: skill.enabled
                            ? "translateX(16px)"
                            : "translateX(0)",
                        }}
                      />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ── MCP Connectors ── */}
            {activeTab === "mcp" && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    Compatible Apps ({filteredApps.length})
                  </div>
                  <span className="text-[10px] text-gray-600">
                    {mcpServers.length} connected
                  </span>
                </div>

                <input
                  value={mcpFilter}
                  onChange={(e) => setMcpFilter(e.target.value)}
                  placeholder="Search apps..."
                  className="glass-input w-full px-3 py-2 rounded-xl text-xs text-white placeholder-gray-600"
                />

                <div className="space-y-1.5">
                  {filteredApps.map((app) => {
                    const connected = mcpServers.includes(app.name);
                    return (
                      <div
                        key={app.name}
                        className={`glass-card p-3 flex items-center gap-3 cursor-pointer transition-all ${
                          connected ? "border-indigo-500/30 bg-indigo-500/5" : ""
                        }`}
                        onClick={() => connectMcp(app.name)}
                      >
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold font-mono ${
                            connected
                              ? "bg-indigo-500/20 text-indigo-400"
                              : "bg-gray-800 text-gray-500"
                          }`}
                        >
                          {app.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white">{app.name}</div>
                          <div className="text-[10px] text-gray-500">
                            {app.category}
                          </div>
                        </div>
                        <div
                          className={`h-5 w-5 rounded-md flex items-center justify-center border transition-all ${
                            connected
                              ? "bg-indigo-500 border-indigo-400 text-white"
                              : "border-gray-600 text-transparent"
                          }`}
                        >
                          <CheckIcon size={10} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Autonomous ── */}
            {activeTab === "autonomous" && (
              <div className="space-y-4 animate-fade-in">
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <ZapIcon size={18} className={autonomous ? "text-yellow-400" : "text-gray-500"} />
                      <span className="font-medium text-white text-sm">
                        Autonomous Mode
                      </span>
                    </div>
                    <button
                      onClick={toggleAutonomous}
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        autonomous ? "bg-gradient-to-r from-yellow-500 to-orange-500" : "bg-gray-700"
                      }`}
                    >
                      <div
                        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                        style={{ transform: autonomous ? "translateX(22px)" : "translateX(2px)" }}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {autonomous
                      ? "Active — agent runs on server independently. Continues even if you log out. No permission prompts."
                      : "Enable to let the agent work autonomously on the server without asking for permissions."}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                    Task / Instructions
                  </label>
                  <textarea
                    value={autonomousTask}
                    onChange={(e) => setAutonomousTask(e.target.value)}
                    placeholder="Describe what the agent should do... e.g. 'Review open PRs, fix lint errors, update dependencies, commit changes'"
                    rows={4}
                    className="glass-input w-full px-3 py-2.5 rounded-xl text-xs text-white placeholder-gray-600 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block font-medium">
                    Repository URL (optional)
                  </label>
                  <input
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/you/repo"
                    className="glass-input w-full px-3 py-2.5 rounded-xl text-xs text-white placeholder-gray-600 font-mono"
                  />
                </div>

                <button
                  onClick={toggleAutonomous}
                  className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
                    autonomous
                      ? "glass-btn-danger text-red-400"
                      : "glass-btn-primary text-white"
                  }`}
                >
                  {autonomous ? "Stop Autonomous Mode" : "Start Autonomous Task"}
                </button>

                <div className="glass-card p-3">
                  <div className="text-xs text-gray-500 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <CheckIcon size={10} className="text-emerald-400 shrink-0" />
                      Works on server after you leave
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckIcon size={10} className="text-emerald-400 shrink-0" />
                      No permission prompts needed
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckIcon size={10} className="text-emerald-400 shrink-0" />
                      Auto-commits changes to linked repo
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckIcon size={10} className="text-emerald-400 shrink-0" />
                      Tests itself after completing tasks
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── API Keys ── */}
            {activeTab === "keys" && (
              <div className="space-y-3 animate-fade-in">
                <div className="text-xs text-gray-500 uppercase tracking-wide">
                  External Model Keys
                </div>
                <p className="text-[11px] text-gray-600">
                  Optional. Free opencode agents work without any keys.
                </p>
                {[
                  { id: "anthropic", name: "Anthropic", models: "Claude Sonnet 4, Haiku 4" },
                  { id: "openai", name: "OpenAI", models: "GPT-4o, GPT-4o Mini" },
                  { id: "google", name: "Google", models: "Gemini 2.0" },
                  { id: "groq", name: "Groq", models: "Llama 3 (free tier)" },
                  { id: "deepseek", name: "DeepSeek", models: "DeepSeek Chat" },
                  { id: "mistral", name: "Mistral", models: "Mistral Small" },
                ].map((p) => (
                  <div key={p.id} className="glass-card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-white">{p.name}</div>
                        <div className="text-[10px] text-gray-500">{p.models}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="API key"
                        className="glass-input flex-1 px-3 py-1.5 rounded-lg text-xs font-mono text-white"
                      />
                      <button
                        onClick={() => toast(`${p.name} key saved`, "success")}
                        className="glass-btn px-3 py-1.5 rounded-lg text-xs text-gray-300"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Settings ── */}
            {activeTab === "settings" && (
              <div className="space-y-4 animate-fade-in">
                <div className="text-xs text-gray-500 uppercase tracking-wide">
                  Account
                </div>

                {user ? (
                  <div className="glass-card p-4 space-y-3">
                    <div>
                      <label className="text-xs text-gray-400">Email</label>
                      <input
                        value={user.email || ""}
                        disabled
                        className="glass-input w-full px-3 py-2 rounded-lg text-sm opacity-50 text-white mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Display Name</label>
                      <input
                        defaultValue={user.user_metadata?.full_name || ""}
                        className="glass-input w-full px-3 py-2 rounded-lg text-sm text-white mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toast("Settings saved", "success")}
                        className="glass-btn-primary px-4 py-2 rounded-lg text-xs text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          logout();
                          router.push("/");
                        }}
                        className="glass-btn-danger px-4 py-2 rounded-lg text-xs text-red-400"
                      >
                        Sign Out
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="glass-card p-4 text-center">
                    <LockIcon size={20} className="mx-auto text-gray-600 mb-2" />
                    <p className="text-sm text-gray-400 mb-3">
                      Guest mode — sessions not saved
                    </p>
                    <Link
                      href="/register"
                      onClick={onClose}
                      className="glass-btn-primary inline-block px-5 py-2 rounded-xl text-xs text-white font-medium"
                    >
                      Create Account
                    </Link>
                  </div>
                )}

                <div className="text-xs text-gray-500 uppercase tracking-wide mt-6">
                  Usage
                </div>
                <UsagePanel />

                <div className="text-xs text-gray-500 uppercase tracking-wide mt-6">
                  About
                </div>
                <div className="glass-card p-3 text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Engine</span>
                    <span className="text-gray-400">opencode SDK</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Package</span>
                    <span className="text-gray-400 font-mono">com.hx.foundacrm</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Version</span>
                    <span className="text-gray-400">0.1.0</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-white/5">
            <div className="flex items-center justify-between text-[10px] text-gray-600">
              <span>Founda CRM</span>
              <span>Powered by opencode</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function ClipboardIconSmall() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}