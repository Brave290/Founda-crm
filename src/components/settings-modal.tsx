"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { UsagePanel, useToast } from "@/components/UsagePanel";
import { XIcon, CheckIcon, UserIcon, LayersIcon, BarChartIcon, ExternalLinkIcon, TrashIcon, ClockIcon, PlusIcon, PlugIcon, KeyIcon, ChatIcon } from "@/components/icons";
import { McpPanel } from "@/components/mcp-panel";
import { loadGuestSessions, saveGuestSession } from "@/lib/auth";
import { DEFAULT_MODEL } from "@/lib/models";
import { fetchJSON } from "@/lib/net";
import { SKILLS, SKILL_CATEGORIES, type SkillCategory } from "@/lib/skills";

type Tab = "account" | "model" | "mcp" | "keys" | "usage" | "skills" | "schedule" | "data";

export function SettingsModal({
  open,
  onClose,
  initialTab,
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: string;
}) {
  const router = useRouter();
  const { user, guest, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("account");
  const [models, setModels] = useState<any[]>([]);
  const [model, setModel] = useState<string>("");
  const [displayName, setDisplayName] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [tPrompt, setTPrompt] = useState("");
  const [tKind, setTKind] = useState("daily");
  const [tTime, setTTime] = useState("08:00");
  const [tOnce, setTOnce] = useState("");
  const [tEmail, setTEmail] = useState("");
  const [smtp, setSmtp] = useState({ host: "smtp.gmail.com", port: "587", user: "", pass: "" });
  const [busyT, setBusyT] = useState(false);
  const [skillSel, setSkillSel] = useState<Set<string>>(new Set());
  const [skillQuery, setSkillQuery] = useState("");
  const [skillCat, setSkillCat] = useState<"All" | SkillCategory>("All");
  const [customSkills, setCustomSkills] = useState<any[]>([]);
  const [importUrl, setImportUrl] = useState("");
  const [importData, setImportData] = useState("");
  const [importing, setImporting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const { toast, Toaster } = useToast();

  const headers = async () => {
    const st = await import("@/lib/store");
    return { "Content-Type": "application/json", "x-device-id": st.getDeviceId() };
  };

  const loadTasks = async () => {
    try {
      const h = await headers();
      const d = await fetchJSON("/api/tasks", { headers: h }, { timeoutMs: 12_000, retries: 2 });
      if (Array.isArray(d.tasks)) setTasks(d.tasks);
      if (d.email && (d.email.user || d.email.host)) {
        setSmtp((v) => ({ ...v, host: d.email.host || v.host, port: String(d.email.port || v.port), user: d.email.user || v.user }));
      }
    } catch {}
  };

  const taskAction = async (body: Record<string, any>, successMsg?: string) => {
    setBusyT(true);
    try {
      const h = await headers();
      const r = await fetch("/api/tasks", { method: "POST", headers: h, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { toast(d.error || "Request failed", "error"); return; }
      if (d.tasks) setTasks(d.tasks);
      else if (d.task && body.action === "create") setTasks((t) => [...t, d.task]);
      else await loadTasks();
      if (successMsg) toast(successMsg, "success");
    } catch { toast("Request failed", "error"); }
    finally { setBusyT(false); }
  };

  const createTask = async () => {
    if (!tPrompt.trim()) { toast("Enter a task description", "error"); return; }
    let runAtISO: string;
    if (tOnce) {
      runAtISO = new Date(tOnce).toISOString();
    } else {
      const [h, m] = tTime.split(":").map(Number);
      const d = new Date();
      d.setHours(h || 8, m || 0, 0, 0);
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
      runAtISO = d.toISOString();
    }
    await taskAction(
      { action: "create", prompt: tPrompt.trim(), kind: tOnce ? "once" : tKind, runAt: runAtISO, email: tEmail.trim() || null },
      "Task scheduled"
    );
    setTPrompt("");
  };

  useEffect(() => {
    if (!open) return;
    fetchJSON("/api/models", {}, { timeoutMs: 15_000, retries: 2 })
      .then((d) => setModels(Array.isArray(d.models) ? d.models.filter((m: any) => m.available) : []))
      .catch(() => {});
    import("@/lib/store")
      .then(async (st) => {
        await st.ready();
        setModel(st.getPrefs().model || DEFAULT_MODEL);
        setDisplayName(st.getPrefs().displayName || "");
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (open) setTab(((initialTab as Tab) || "account"));
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || tab !== "schedule") return;
    void loadTasks();
    const timer = setInterval(() => { void loadTasks(); }, 30_000);
    return () => clearInterval(timer);
  }, [open, tab]);

  useEffect(() => {
    if (open && tab !== "skills") return;
    if (!open) return;
    import("@/lib/store")
      .then(async (st) => {
        await st.ready();
        const p = st.getPrefs();
        const sel = Array.isArray(p.skills) ? p.skills.map(String) : SKILLS.map((x) => x.id);
        setSkillSel(new Set(sel));
        setCustomSkills(Array.isArray(p.customSkills) ? p.customSkills : []);
      })
      .catch(() => {});
  }, [open, tab]);

  const persistSkills = (next: Set<string>) => {
    setSkillSel(new Set(next));
    import("@/lib/store")
      .then((st) => st.savePrefs({ skills: [...next] }))
      .catch(() => {});
  };

  const toggleSkill = (id: string) => {
    const next = new Set(skillSel);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    persistSkills(next);
  };

  const importSkill = async () => {
    const url = importUrl.trim();
    if (!/^https?:\/\//.test(url)) {
      toast("Paste a raw .md / SKILL.md URL", "error");
      return;
    }
    setImporting(true);
    try {
      const d = await fetchJSON("/api/skill/fetch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, max: 40_000 }) }, { timeoutMs: 20_000, retries: 1 });
      const md = String(d.text || "");
      if (md.length < 40) throw new Error("too short to be a skill");
      const title = (/^#\s+(.+)$/m.exec(md)?.[1] || /name\s*:\s*(.+)/i.exec(md)?.[1] || url.split("/").pop() || "Imported skill").trim();
      const desc = md
        .replace(/^---[\s\S]*?---/, "")
        .split("\n\n")
        .map((p: string) => p.trim())
        .filter((p: string) => p && !p.startsWith("#") && !p.startsWith("```"))
        .join(" ")
        .slice(0, 180);
      const entry = { id: `url:${url}`, name: title.slice(0, 80), description: desc, instructions: md.slice(0, 40_000) };
      const next = [...customSkills.filter((c) => c.id !== entry.id), entry];
      setCustomSkills(next);
      import("@/lib/store").then((st) => st.savePrefs({ customSkills: next })).catch(() => {});
      setImportUrl("");
      toast(`Imported "${entry.name}"`, "success");
    } catch (e: any) {
      toast(e?.message || "Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  const removeCustomSkill = (id: string) => {
    const next = customSkills.filter((c) => c.id !== id);
    setCustomSkills(next);
    import("@/lib/store").then((st) => st.savePrefs({ customSkills: next })).catch(() => {});
  };

  if (!open) return null;

  const pickModel = (id: string) => {
    setModel(id);
    import("@/lib/store").then((st) => st.savePrefs({ model: id })).catch(() => {});
    toast(id ? `Model set` : "Model: auto", "success");
  };

  const saveName = async () => {
    import("@/lib/store").then((st) => st.savePrefs({ displayName })).catch(() => {});
    if (user) {
      try {
        const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
        const sb = createSupabaseBrowserClient();
        await sb.from("profiles").upsert({
          id: user.id,
          display_name: displayName,
          updated_at: new Date().toISOString(),
        });
      } catch {}
    }
    toast("Name saved", "success");
  };

  const clearData = () => {
    if (!confirm("Delete all chats, keys and settings from the server?")) return;
    import("@/lib/store")
      .then((st) => {
        st.clearAllStoreData();
        toast("All data cleared", "success");
        setTimeout(() => window.location.reload(), 600);
      })
      .catch(() => {});
  };

  const importSession = () => {
    try {
      const parsed = JSON.parse(importData);
      saveGuestSession({
        id: crypto.randomUUID(),
        title: parsed.title || "Imported chat",
        agent: parsed.agent_name || "build",
        messages: parsed.state?.messages || [],
        createdAt: new Date().toISOString(),
      });
      setImportData("");
      toast(`Imported ${(parsed.state?.messages || []).length} messages`, "success");
    } catch {
      toast("Invalid JSON", "error");
    }
  };

  const doLogout = () => {
    logout();
    onClose();
    router.push("/");
  };

  const deleteAccount = async () => {
    if (!user || deletingAccount) return;
    const confirmed = window.confirm(
      "Permanently delete your account and all chats, tasks, scheduled jobs, MCP connections, and profile data? This cannot be undone."
    );
    if (!confirmed) return;
    const typed = window.prompt("Type DELETE to confirm account deletion:");
    if (typed !== "DELETE") {
      toast("Account deletion cancelled", "error");
      return;
    }
    setDeletingAccount(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "DELETE" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Account deletion failed");
      await logout();
      onClose();
      router.replace("/");
    } catch (error: any) {
      toast(error?.message || "Account deletion failed", "error");
      setDeletingAccount(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "account", label: "Account", icon: <UserIcon size={14} /> },
    { id: "model", label: "Model", icon: <LayersIcon size={14} /> },
    { id: "mcp", label: "MCP", icon: <PlugIcon size={14} /> },
    { id: "keys", label: "API keys", icon: <KeyIcon size={14} /> },
    { id: "usage", label: "Usage", icon: <BarChartIcon size={14} /> },
    {
      id: "skills",
      label: "Skills",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3.5a1.5 1.5 0 013 0V5h4a1 1 0 011 1v4h1.5a1.5 1.5 0 010 3H18v4a1 1 0 01-1 1h-4v-1.5a1.5 1.5 0 00-3 0V18H6a1 1 0 01-1-1v-4H3.5a1.5 1.5 0 010-3H5V6a1 1 0 011-1h4V3.5z" />
        </svg>
      ),
    },
    { id: "schedule", label: "Schedule", icon: <ClockIcon size={14} /> },
    { id: "data", label: "Data", icon: <TrashIcon size={14} /> },
  ];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8 bg-black/70 backdrop-blur-3xl animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <Toaster />
      <div className="w-full max-w-2xl h-[min(640px,90vh)] rounded-2xl bg-[#10141f] border border-white/[0.08] shadow-2xl shadow-black/70 flex overflow-hidden animate-scale-in">
        {/* left nav */}
        <div className="w-40 shrink-0 bg-[#0a0e17] border-r border-white/[0.06] p-2 flex flex-col">
          <div className="px-3 pt-3 pb-2 text-[13px] font-semibold text-white">Settings</div>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                tab === t.id
                  ? "bg-white/[0.07] text-white"
                  : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
          <div className="mt-auto">
            <button
              onClick={() => {
                onClose();
                router.push(`/sessions/${crypto.randomUUID()}`);
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] w-full transition-colors"
            >
              <ChatIcon size={13} />
              New chat
            </button>
          </div>
        </div>

        {/* content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <span className="text-[15px] font-semibold text-white">
              {TABS.find((t) => t.id === tab)?.label}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06]" title="Close">
              <XIcon size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {tab === "account" && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <span className="h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl font-semibold flex items-center justify-center">
                    {(user?.email?.[0] || (guest ? "G" : "?")).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="text-white text-sm font-medium truncate">
                      {user?.email || (guest ? "Guest session" : "Not signed in")}
                    </div>
                    <div className="text-[12px] text-slate-500">
                      {user ? "Chats sync across all your devices" : "Stored on this device profile"}
                    </div>
                  </div>
                </div>

                {!user && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                    <p className="text-[13px] text-emerald-200 mb-2.5">
                      Create an account to sync chats across devices.
                    </p>
                    <button
                      onClick={() => {
                        onClose();
                        router.push("/register");
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[13px] font-medium transition-colors"
                    >
                      Create account
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-[12px] text-slate-500 mb-1.5">Display name</label>
                  <div className="flex gap-2">
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder-slate-600 focus:outline-none focus:border-white/20"
                    />
                    <button
                      onClick={saveName}
                      className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[13px] text-white transition-colors"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.06]">
                  <button
                    onClick={doLogout}
                    className="text-[13px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    {user ? "Log out" : "Exit to home"}
                  </button>
                  {user && (
                    <button
                      onClick={deleteAccount}
                      disabled={deletingAccount}
                      className="block mt-3 text-[12px] text-red-500/80 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      {deletingAccount ? "Deleting account…" : "Delete my account"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {tab === "model" && (
              <div className="space-y-1.5">
                <button
                  onClick={() => pickModel("")}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    !model
                      ? "border-emerald-500/40 bg-emerald-500/[0.07]"
                      : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-white">Auto (default)</span>
                    {!model && <CheckIcon size={14} className="text-emerald-400" />}
                  </div>
                  <span className="text-[12px] text-slate-500">Best available free model</span>
                </button>

                {models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => pickModel(m.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                      model === m.id
                        ? "border-emerald-500/40 bg-emerald-500/[0.07]"
                        : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[14px] text-white truncate">{m.label}</span>
                      {model === m.id && <CheckIcon size={14} className="text-emerald-400 shrink-0" />}
                    </div>
                    <span className="text-[11px] text-slate-600 font-mono truncate block">
                      {m.id} · {m.providerLabel}
                    </span>
                  </button>
                ))}

                {models.length === 0 && (
                  <p className="text-[13px] text-slate-600 py-4 text-center">Loading models…</p>
                )}
              </div>
            )}

            {tab === "mcp" && <McpPanel />}
            {tab === "keys" && <ApiKeysPanel onToast={toast} />}
            {tab === "usage" && (
              <div>
                <UsagePanel />
              </div>
            )}

            {tab === "schedule" && (
              <div className="space-y-6">
                {/* SMTP */}
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                  <div className="text-[14px] text-white">Email (Gmail SMTP)</div>
                  <p className="text-[12px] text-slate-500 -mt-1.5">
                    Used for daily news digests and task-done reminders. For Gmail, create an
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300"> App Password</a> and use it as the password.
                  </p>
                  <div className="grid grid-cols-[1fr_72px] gap-2">
                    <input value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} placeholder="smtp.gmail.com"
                      className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white font-mono placeholder-slate-600 focus:outline-none focus:border-white/20" />
                    <input value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: e.target.value })} placeholder="587"
                      className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white font-mono placeholder-slate-600 focus:outline-none focus:border-white/20" />
                  </div>
                  <input value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} placeholder="you@gmail.com"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white font-mono placeholder-slate-600 focus:outline-none focus:border-white/20" />
                  <input value={smtp.pass} onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })} type="password" placeholder="App password"
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white font-mono placeholder-slate-600 focus:outline-none focus:border-white/20" />
                  <div className="flex gap-2">
                    <button disabled={busyT} onClick={() => taskAction({ action: "saveemail", smtp }, "SMTP saved")}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-medium transition-colors disabled:opacity-50">
                      Save
                    </button>
                    <button disabled={busyT} onClick={() => taskAction({ action: "emailtest", smtp, to: smtp.user }, "Test email sent")}
                      className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[13px] text-white transition-colors disabled:opacity-50">
                      Send test
                    </button>
                  </div>
                </div>

                {/* Create */}
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[14px] text-white">Schedule a task</div>
                    <button onClick={() => {
                      setTPrompt("Using webfetch, gather today's top 8-10 news stories (world, tech, business, science) from reputable sources. Output a clean digest: 2-3 sentence summary per story with the source name.");
                      setTKind("daily"); setTTime("08:00"); setTOnce("");
                    }} className="text-[11.5px] text-emerald-400 hover:text-emerald-300">
                      + Daily news digest
                    </button>
                  </div>
                  <textarea value={tPrompt} onChange={(e) => setTPrompt(e.target.value)} rows={3}
                    placeholder="What should the agent do? e.g. Check my GitHub issues and email me a summary"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-white/20 resize-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={tOnce ? "once" : tKind} onChange={(e) => { if (e.target.value === "once") { setTOnce(new Date(Date.now() + 3600_000).toISOString().slice(0, 16)); } else { setTOnce(""); setTKind(e.target.value); } }}
                      className="px-3 py-2 rounded-lg bg-[#101624] border border-white/[0.08] text-[13px] text-white focus:outline-none focus:border-white/20">
                      <option value="daily">Daily</option>
                      <option value="weekdays">Weekdays</option>
                      <option value="weekly">Weekly</option>
                      <option value="once">Once</option>
                    </select>
                    {tOnce ? (
                      <input type="datetime-local" value={tOnce} onChange={(e) => setTOnce(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white font-mono focus:outline-none focus:border-white/20" />
                    ) : (
                      <input type="time" value={tTime} onChange={(e) => setTTime(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[13px] text-white font-mono focus:outline-none focus:border-white/20" />
                    )}
                  </div>
                  <input value={tEmail} onChange={(e) => setTEmail(e.target.value)} type="email" placeholder="Notify me at (optional — result emailed when done)"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-white/20" />
                  <button disabled={busyT} onClick={createTask}
                    className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[13.5px] font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <PlusIcon size={14} /> {busyT ? "Scheduling…" : "Schedule"}
                  </button>
                </div>

                {/* List */}
                <div className="space-y-2">
                  <div className="text-[14px] text-white">Your tasks <span className="text-slate-600 text-[12px]">— run on the server even when offline</span></div>
                  {tasks.length === 0 && <p className="text-[12.5px] text-slate-600">Nothing scheduled yet.</p>}
                  {tasks.map((t) => (
                    <div key={t.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[13px] text-white line-clamp-2">{t.prompt}</div>
                          <div className="text-[11px] text-slate-600 mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
                            <span className="uppercase tracking-wide">{t.kind}</span>
                            <span>{new Date(t.run_at).toLocaleString()}</span>
                            {t.email && <span className="text-emerald-500/80">→ {t.email}</span>}
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className={`text-[10.5px] px-1.5 py-0.5 rounded-full border ${
                              t.status === "pending" ? "border-sky-500/30 text-sky-300 bg-sky-500/[0.07]" :
                              t.status === "running" ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/[0.07]" :
                              t.status === "done" ? "border-white/10 text-slate-500" :
                              t.status === "failed" ? "border-red-500/30 text-red-400 bg-red-500/[0.07]" :
                              "border-amber-500/30 text-amber-300 bg-amber-500/[0.07]"
                            }`}>{t.status}</span>
                            {t.error && <span className="text-[10.5px] text-red-400/80 truncate max-w-[220px]">{t.error}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button disabled={busyT} onClick={() => taskAction({ action: "runnow", id: t.id }, "Running now…")}
                            className="px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-[11.5px] text-white transition-colors disabled:opacity-50">
                            Run now
                          </button>
                          <div className="flex gap-1.5">
                            <button disabled={busyT} onClick={() => taskAction({ action: "update", id: t.id, status: t.status === "paused" ? "pending" : "paused" })}
                              className="px-2.5 py-1 rounded-md bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-[11.5px] text-slate-300 transition-colors disabled:opacity-50">
                              {t.status === "paused" ? "Resume" : "Pause"}
                            </button>
                            <button disabled={busyT} onClick={() => taskAction({ action: "delete", id: t.id }, "Deleted")}
                              className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50" title="Delete">
                              <TrashIcon size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                      {t.last_result && (
                        <details className="mt-2">
                          <summary className="text-[11.5px] text-slate-500 cursor-pointer hover:text-slate-300">Last result</summary>
                          <pre className="mt-1.5 text-[11.5px] font-mono text-slate-500 whitespace-pre-wrap max-h-44 overflow-y-auto bg-black/30 rounded-lg p-2.5">{t.last_result}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "skills" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[180px]">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
                    </svg>
                    <input
                      value={skillQuery}
                      onChange={(e) => setSkillQuery(e.target.value)}
                      placeholder="Search skills — image, video, search, chart, tweet…"
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[13px] text-white placeholder-slate-600 focus:outline-none focus:border-white/20 transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => persistSkills(new Set(SKILLS.map((x) => x.id)))}
                    className="px-3 py-2 rounded-lg text-[12px] text-emerald-300 border border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                  >
                    Enable all {SKILLS.length}
                  </button>
                  <button
                    onClick={() => persistSkills(new Set())}
                    className="px-3 py-2 rounded-lg text-[12px] text-slate-400 border border-white/10 hover:bg-white/[0.06] transition-colors"
                  >
                    Disable all
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(["All", ...SKILL_CATEGORIES] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setSkillCat(c as any)}
                      className={`px-2.5 py-1 rounded-full text-[11.5px] transition-colors ${
                        skillCat === c
                          ? "bg-white/[0.1] text-white border border-white/20"
                          : "text-slate-500 border border-white/[0.07] hover:text-slate-300"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <div className="text-[11.5px] text-slate-600">
                  {skillSel.size} of {SKILLS.length} built-in skills active
                  {customSkills.length > 0 && ` · ${customSkills.length} imported`}
                  {" — active skills are injected into every chat so the AI uses them automatically."}
                </div>

                {customSkills.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-amber-400/25 bg-amber-500/[0.06] px-3.5 py-2.5 flex items-start gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-amber-100 font-medium truncate">{c.name}</div>
                      <div className="text-[11.5px] text-amber-200/60 truncate">{c.description || c.id}</div>
                    </div>
                    <button
                      onClick={() => removeCustomSkill(c.id)}
                      className="text-[11.5px] text-red-300 hover:text-red-200 transition-colors shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                <div className="flex gap-2">
                  <input
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && importSkill()}
                    placeholder="Import skill from URL — raw GitHub SKILL.md or any .md"
                    className="flex-1 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[12.5px] text-white placeholder-slate-600 focus:outline-none focus:border-white/20 transition-colors"
                  />
                  <button
                    onClick={importSkill}
                    disabled={importing}
                    className="px-3.5 py-2 rounded-lg text-[12.5px] font-medium bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                  >
                    {importing ? "Importing…" : "Import"}
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  {SKILLS.filter((k) => {
                    if (skillCat !== "All" && k.category !== skillCat) return false;
                    const q = skillQuery.toLowerCase().trim();
                    if (!q) return true;
                    return (
                      k.name.toLowerCase().includes(q) ||
                      k.description.toLowerCase().includes(q) ||
                      k.id.includes(q) ||
                      k.category.toLowerCase().includes(q) ||
                      k.triggers.some((t) => t.toLowerCase().includes(q))
                    );
                  }).map((k) => {
                    const on = skillSel.has(k.id);
                    return (
                      <button
                        key={k.id}
                        onClick={() => toggleSkill(k.id)}
                        className={`text-left rounded-xl border px-3.5 py-3 transition-all ${
                          on
                            ? "border-emerald-400/35 bg-emerald-500/[0.07]"
                            : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[13px] font-medium ${on ? "text-white" : "text-slate-400"}`}>
                            {k.name}
                          </span>
                          <span
                            className={`h-4 w-7 rounded-full p-0.5 transition-colors shrink-0 ${
                              on ? "bg-emerald-500" : "bg-white/10"
                            }`}
                          >
                            <span
                              className={`block h-3 w-3 rounded-full bg-white transition-transform ${
                                on ? "translate-x-3" : ""
                              }`}
                            />
                          </span>
                        </div>
                        <div className="text-[11.5px] text-slate-600 mt-0.5 line-clamp-2 leading-snug">
                          {k.description}
                        </div>
                        <div className="text-[10px] text-slate-700 mt-1">{k.category}</div>
                      </button>
                    );
                  })}
                  {SKILLS.filter((k) => {
                    if (skillCat !== "All" && k.category !== skillCat) return false;
                    const q = skillQuery.toLowerCase().trim();
                    return !q || k.name.toLowerCase().includes(q) || k.description.toLowerCase().includes(q) || k.id.includes(q) || k.category.toLowerCase().includes(q) || k.triggers.some((t) => t.toLowerCase().includes(q));
                  }).length === 0 && (
                    <div className="col-span-full text-center py-6 text-[12.5px] text-slate-600">
                      No skills match &quot;{skillQuery}&quot; — try the web-search skill, or import one from a URL above.
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === "data" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="text-[14px] text-white mb-1">Export your chats</div>
                  <p className="text-[12.5px] text-slate-500 mb-3">
                    Open a chat and use /export json · md · png.
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="text-[14px] text-white mb-1">Import a chat</div>
                  <p className="text-[12.5px] text-slate-500 mb-3">
                    Paste session JSON exported from here or another Founda install.
                  </p>
                  <textarea value={importData} onChange={(e) => setImportData(e.target.value)} rows={3}
                    placeholder={'{"title": "...", "state": {"messages": [...]}}'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-[12px] font-mono text-white placeholder-slate-600 resize-none focus:outline-none focus:border-white/20 transition-colors" />
                  <button onClick={importSession} disabled={!importData.trim()}
                    className="mt-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-medium transition-colors disabled:opacity-40">
                    Import
                  </button>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4">
                  <div className="text-[14px] text-white mb-1">Delete all data</div>
                  <p className="text-[12.5px] text-slate-500 mb-3">
                    Removes every chat, preference and key from the server.
                  </p>
                  <button
                    onClick={clearData}
                    className="px-4 py-2 rounded-lg bg-red-500/90 hover:bg-red-500 text-white text-[13px] font-medium transition-colors"
                  >
                    Delete everything
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── API keys (moved from the old dashboard) ──
function ApiKeysPanel({ onToast }: { onToast: (msg: string, type?: any) => void }) {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    import("@/lib/store")
      .then(async (st) => {
        await st.ready();
        setApiKeys({ ...st.getApiKeys() });
      })
      .catch(() => {});
  }, []);

  const saveKey = async (provider: string) => {
    setSavingKeys((s) => ({ ...s, [provider]: true }));
    try {
      const st = await import("@/lib/store");
      st.saveApiKey(provider, apiKeys[provider] || "");
      await st.ready();
      onToast("Key saved to your account", "success");
    } catch {
      onToast("Could not save key", "error");
    }
    setSavingKeys((s) => ({ ...s, [provider]: false }));
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[14px] text-white mb-1 flex items-center gap-2">
          <KeyIcon size={15} className="text-amber-400" /> External API keys
        </div>
        <p className="text-[12.5px] text-slate-500">
          Stored server-side in your profile — synced across every device you sign in on. Models using these keys appear in the Model picker.
        </p>
      </div>
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
              className="w-32 px-3 py-1.5 rounded-lg text-xs font-mono text-white bg-black/40 border border-white/10 placeholder-slate-700 focus:outline-none focus:border-white/20" />
            <button onClick={() => saveKey(p.id)} disabled={savingKeys[p.id]}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] transition-colors disabled:opacity-40">
              {savingKeys[p.id] ? "Saving…" : "Save"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
