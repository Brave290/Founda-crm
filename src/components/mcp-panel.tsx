"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/UsagePanel";
import { SearchIcon, PlusIcon, TrashIcon, CheckIcon } from "@/components/icons";
import { MCP_PRESETS, MCP_CATEGORIES, splitCommand, type McpPreset } from "@/lib/mcp-presets";

// ── MCP connector browser + connect form (shared with Settings → MCP) ──
// ── MCP Tab ──
function McpPanel() {
  const [servers, setServers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [mode, setMode] = useState<"url" | "command">("url");
  const [name, setName] = useState("");
  const [command, setCommand] = useState("");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState("");
  const [envJson, setEnvJson] = useState("");
  const [activePreset, setActivePreset] = useState<McpPreset | null>(null);
  const [tokenVal, setTokenVal] = useState("");
  const [envVals, setEnvVals] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");
  const [busy, setBusy] = useState(false);
  const { toast, Toaster } = useToast();

  const refresh = () =>
    fetch("/api/opencode/mcp")
      .then((r) => r.json())
      .then((d) => { if (d.servers) setServers(Array.isArray(d.servers) ? d.servers : []); })
      .catch(() => {});
  useEffect(() => { refresh(); }, []);

  const pickPreset = (p: McpPreset) => {
    setActivePreset(p);
    setShowAdd(true);
    setName(p.name);
    setTokenVal("");
    setEnvVals({});
    setHeaders("");
    setEnvJson("");
    if (p.mode === "remote") {
      setMode("url");
      setUrl(p.url || "");
    } else {
      setMode("command");
      setCommand(p.command || "");
      setUrl("");
    }
  };

  const resetForm = () => {
    setActivePreset(null); setTokenVal(""); setEnvVals({});
    setName(""); setUrl(""); setHeaders(""); setCommand(""); setEnvJson("");
    setShowAdd(false);
  };

  const addServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      let config: any;
      let label: string;
      if (mode === "url") {
        let hdrs: Record<string, string> = {};
        if (headers.trim()) {
          try { hdrs = JSON.parse(headers); }
          catch { toast("Headers must be valid JSON", "error"); setBusy(false); return; }
        }
        if (activePreset?.authHeader && tokenVal.trim()) {
          hdrs[activePreset.authHeader.header] = (activePreset.authHeader.prefix || "") + tokenVal.trim();
        }
        label = name.trim() || new URL(url).hostname;
        config = {
          type: "remote",
          url: url.trim(),
          ...(Object.keys(hdrs).length ? { headers: hdrs } : {}),
          timeout: 30000,
        };
      } else {
        let cmd = command;
        if (activePreset?.argToken && tokenVal.trim()) {
          cmd = cmd.split(activePreset.argToken.marker).join(tokenVal.trim());
        }
        const argv = splitCommand(cmd);
        if (!argv.length) { toast("Enter a command", "error"); setBusy(false); return; }
        const env: Record<string, string> = {};
        for (const k of activePreset?.envKeys || []) {
          if (envVals[k]) env[k] = envVals[k];
        }
        if (envJson.trim()) {
          try { Object.assign(env, JSON.parse(envJson)); }
          catch { toast("Environment must be valid JSON", "error"); setBusy(false); return; }
        }
        label = name.trim() || argv[argv.length - 1].split("/").pop()!.split("@")[0];
        config = {
          type: "local",
          command: argv,
          ...(Object.keys(env).length ? { environment: env } : {}),
          timeout: 30000,
        };
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
        resetForm();
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

  const term = q.toLowerCase().trim();
  const filtered = MCP_PRESETS.filter(
    (p) => (cat === "All" || p.category === cat) &&
      (!term || (p.name + " " + p.desc + " " + p.id).toLowerCase().includes(term))
  );

  return (
    <div>
      <Toaster />
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-white">MCP servers</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">
            {MCP_PRESETS.length} built-in connectors — link, command, or search below
          </p>
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
                {activePreset?.authHeader && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">{activePreset.authHeader.label}</label>
                    <input value={tokenVal} onChange={(e) => setTokenVal(e.target.value)} type="password"
                      placeholder={activePreset.authHeader.prefix === "Bearer " ? "Bearer token / API key" : "API key"}
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white font-mono placeholder-slate-600" />
                  </div>
                )}
                <textarea value={headers} onChange={(e) => setHeaders(e.target.value)} rows={2}
                  placeholder={'Optional headers JSON: {"Authorization": "Bearer …"}'}
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-[12.5px] text-white font-mono placeholder-slate-600 resize-none" />
              </>
            ) : (
              <>
                <input value={command} onChange={(e) => setCommand(e.target.value)}
                  placeholder="Command (e.g. npx -y @modelcontextprotocol/server-github)" required
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white font-mono placeholder-slate-600" />
                {activePreset?.argToken && (
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">{activePreset.argToken.label}</label>
                    <input value={tokenVal} onChange={(e) => setTokenVal(e.target.value)} type="password"
                      placeholder="Token"
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white font-mono placeholder-slate-600" />
                  </div>
                )}
                {(activePreset?.envKeys || []).map((k) => (
                  <div key={k}>
                    <label className="block text-[11px] text-slate-500 mb-1">{k}</label>
                    <input value={envVals[k] || ""} onChange={(e) => setEnvVals({ ...envVals, [k]: e.target.value })}
                      type="password" placeholder={k.split("_").join(" ").toLowerCase()}
                      className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white font-mono placeholder-slate-600" />
                  </div>
                ))}
                <textarea value={envJson} onChange={(e) => setEnvJson(e.target.value)} rows={2}
                  placeholder={'Extra env JSON (optional): {"KEY":"value"}'}
                  className="glass-input w-full px-4 py-2.5 rounded-xl text-[12.5px] text-white font-mono placeholder-slate-600 resize-none" />
              </>
            )}

            <button type="submit" disabled={busy}
              className="glass-btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50">
              {busy ? "Connecting…" : "Connect"}
            </button>
          </form>
        </div>
      )}

      {/* Catalog */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
        <div className="relative flex-1">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${MCP_PRESETS.length} connectors…`}
            className="glass-input w-full pl-9 pr-3 py-2 rounded-xl text-[13px] text-white placeholder-slate-600" />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {["All", ...MCP_CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCat(c)}
            className={`px-3 py-1 rounded-full text-[11.5px] border transition-colors ${
              cat === c
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                : "border-white/[0.08] bg-white/[0.03] text-slate-500 hover:text-slate-300"
            }`}>
            {c}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-6">
        {filtered.map((p) => (
          <button key={p.id} onClick={() => pickPreset(p)}
            className="glass-card p-3.5 text-left !transform-none hover:bg-white/[0.04] transition-colors group">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-white truncate group-hover:text-emerald-200 transition-colors">{p.name}</div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">{p.desc}</div>
              </div>
              <span className={`shrink-0 text-[9.5px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                p.mode === "remote"
                  ? "border-sky-500/25 text-sky-300 bg-sky-500/[0.08]"
                  : "border-amber-500/25 text-amber-300 bg-amber-500/[0.08]"
              }`}>
                {p.mode === "remote" ? "link" : "cli"}
              </span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-slate-600">{p.category}</span>
              <span className={`text-[10px] ${
                p.auth === "OAuth" ? "text-emerald-400" : p.auth === "Free" ? "text-teal-400" : "text-slate-500"
              }`}>{p.auth}</span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-slate-600 text-sm text-center py-8 col-span-full">No connectors match “{q}”.</p>
        )}
      </div>

      <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">Connected</div>
      <div className="space-y-2">
        {servers.map((s: any, i: number) => (
          <div key={i} className="glass-card p-4 flex items-center justify-between animate-fade-up">
            <div className="min-w-0">
              <div className="font-medium text-white text-sm truncate">{s.name || s.id}</div>
              <div className="text-xs text-slate-500 font-mono truncate">
                {s.config?.type === "remote" || s.type === "remote" ? (s.config?.url || s.url || "remote") : ((s.config?.command || s.command || []).join?.(" ") || s.type || "local")}
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

export { McpPanel };
