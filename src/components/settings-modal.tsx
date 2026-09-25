"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { UsagePanel, useToast } from "@/components/UsagePanel";
import { XIcon, CheckIcon, UserIcon, LayersIcon, BarChartIcon, ExternalLinkIcon, TrashIcon } from "@/components/icons";

type Tab = "account" | "model" | "usage" | "data";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user, guest, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("account");
  const [models, setModels] = useState<any[]>([]);
  const [model, setModel] = useState<string>("");
  const [displayName, setDisplayName] = useState("");
  const { toast, Toaster } = useToast();

  useEffect(() => {
    if (!open) return;
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => setModels(Array.isArray(d.models) ? d.models.filter((m: any) => m.available) : []))
      .catch(() => {});
    import("@/lib/store")
      .then(async (st) => {
        await st.ready();
        setModel(st.getPrefs().model || "");
        setDisplayName(st.getPrefs().displayName || "");
      })
      .catch(() => {});
  }, [open]);

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
