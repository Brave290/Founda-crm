"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { UsagePanel, useToast } from "@/components/UsagePanel";
import { XIcon, CheckIcon, UserIcon, LayersIcon, BarChartIcon, ExternalLinkIcon, TrashIcon, ClockIcon, PlusIcon } from "@/components/icons";
import { DEFAULT_MODEL } from "@/lib/models";

type Tab = "account" | "model" | "usage" | "schedule" | "data";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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
  const { toast, Toaster } = useToast();

  const headers = async () => {
    const st = await import("@/lib/store");
    return { "Content-Type": "application/json", "x-device-id": st.getDeviceId() };
  };

  const loadTasks = async () => {
    try {
      const h = await headers();
      const r = await fetch("/api/tasks", { headers: h });
      if (!r.ok) return;
      const d = await r.json();
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
    fetch("/api/models")
      .then((r) => r.json())
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
    if (open && tab === "schedule") loadTasks();
  }, [open, tab]);

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

  const doLogout = () => {
    logout();
    onClose();
    router.push("/");
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "account", label: "Account", icon: <UserIcon size={14} /> },
    { id: "model", label: "Model", icon: <LayersIcon size={14} /> },
    { id: "usage", label: "Usage", icon: <BarChartIcon size={14} /> },
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
                router.push("/dashboard");
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-slate-500 hover:text-slate-300 hover:bg-white/[0.05] w-full transition-colors"
            >
              <ExternalLinkIcon size={13} />
              Dashboard
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

            {tab === "data" && (
              <div className="space-y-5">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="text-[14px] text-white mb-1">Export your chats</div>
                  <p className="text-[12.5px] text-slate-500 mb-3">
                    Open a chat and use /export json · md · png.
                  </p>
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
