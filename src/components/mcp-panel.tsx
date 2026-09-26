"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/UsagePanel";
import { SearchIcon, TrashIcon, CheckIcon, XIcon } from "@/components/icons";
import { McpLogo } from "@/components/mcp-logo";
import { MCP_PRESETS, splitCommand, type McpPreset } from "@/lib/mcp-presets";

// ── Integrations (Manus / ChatGPT style) ────────────────────────────────────
// Every preset is one row: logo · name · description · a single Connect
// button. Clicking Connect either opens the provider's OAuth page in a new
// browser tab (callback relays back through /api/mcp/oauth/*), or — for
// token-based connectors like GitHub — asks for an API key and wires the
// header for you. No command lines, no manual URL forms.

const callbackUrl = () =>
  typeof window !== "undefined" ? `${window.location.origin}/api/mcp/oauth/callback` : "";

function McpPanel() {
  const [servers, setServers] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [tokenFor, setTokenFor] = useState<McpPreset | null>(null);
  const [tokenVal, setTokenVal] = useState("");
  const { toast, Toaster } = useToast();

  const refresh = () =>
    fetch("/api/opencode/mcp")
      .then((r) => r.json())
      .then((d) => {
        if (d.servers) setServers(Array.isArray(d.servers) ? d.servers : []);
      })
      .catch(() => {});
  useEffect(() => {
    refresh();
  }, []);

  const term = q.toLowerCase().trim();
  const filtered = MCP_PRESETS.filter(
    (p) => !term || (p.name + " " + p.desc + " " + p.id).toLowerCase().includes(term)
  );

  // live engine entry for a preset (by name, url or command — same as before)
  const liveFor = (p: McpPreset) =>
    servers.find((s: any) => {
      const n = String(s.name || s.id || "").toLowerCase();
      const u = String(s.config?.url || s.url || "");
      const cmd = String((s.config?.command || s.command || []).join?.(" ") || "");
      return (
        n === p.name.toLowerCase() ||
        n === p.id ||
        (!!p.url && u === p.url) ||
        (!!p.command && cmd === p.command)
      );
    });
  const statusOf = (p: McpPreset): string => String(liveFor(p)?.status || "");

  const connected = (p: McpPreset) => {
    const st = statusOf(p);
    return st === "connected" || st === "ok" || st === "active";
  };

  const buildConfig = (p: McpPreset, token?: string): any => {
    if (p.mode !== "remote") {
      let cmd = p.command || "";
      if (p.argToken && token) cmd = cmd.split(p.argToken.marker).join(token);
      return { type: "local", command: splitCommand(cmd), timeout: 30000 };
    }
    const headers: Record<string, string> = {};
    if (p.authHeader && token) {
      headers[p.authHeader.header] = (p.authHeader.prefix || "") + token.trim();
    }
    return {
      type: "remote",
      url: p.url,
      timeout: 30000,
      ...(Object.keys(headers).length ? { headers } : {}),
      // OAuth presets: tell the provider to send the user back to OUR callback
      // (opencode's default 127.0.0.1 redirect can't reach a browser on
      // someone else's machine).
      ...(p.auth === "OAuth" ? { oauth: { redirectUri: callbackUrl() } } : {}),
    };
  };

  const ensureAdded = async (p: McpPreset, token?: string): Promise<boolean> => {
    if (liveFor(p)) return true;
    const res = await fetch("/api/opencode/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", name: p.name, config: buildConfig(p, token) }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.error) {
      toast(data.error, "error");
      return false;
    }
    await refresh();
    return true;
  };

  // ── OAuth: button → new tab → provider → callback → connected ─────────────
  const oauthFlow = async (p: McpPreset) => {
    setBusyId(p.id);
    setPendingUrl(null);
    // open the tab SYNCHRONOUSLY in the click gesture so popup blockers allow it
    const win = window.open("about:blank", "_blank");
    try {
      const added = await ensureAdded(p);
      if (!added) {
        win?.close();
        return;
      }
      // token-free remote servers may already be connected after add
      if (connected(p)) {
        win?.close();
        toast(`Connected: ${p.name}`, "success");
        return;
      }
      const es = new EventSource(
        `/api/mcp/oauth/flow?name=${encodeURIComponent(p.name)}`
      );
      let finished = false;
      es.addEventListener("auth", (e) => {
        try {
          const { authorizationUrl } = JSON.parse((e as MessageEvent).data);
          if (win && !win.closed) win.location.href = authorizationUrl;
          else setPendingUrl(authorizationUrl);
        } catch {}
      });
      es.addEventListener("done", () => {
        finished = true;
        es.close();
        win?.close();
        toast(`Connected: ${p.name}`, "success");
        refresh();
      });
      es.addEventListener("error", (e: any) => {
        if (e?.data) {
          finished = true;
          es.close();
          win?.close();
          try {
            const msg = JSON.parse(e.data)?.error || "Authorization failed";
            toast(msg, "error");
          } catch {
            toast("Authorization failed", "error");
          }
          refresh();
        } else if (!finished) {
          // transport hiccup — EventSource retries by itself
        }
      });
    } catch (err: any) {
      win?.close();
      toast(err?.message || "Failed to start authorization", "error");
    } finally {
      setBusyId(null);
    }
  };

  const openConnect = (p: McpPreset) => {
    if (p.authHeader || p.argToken) {
      // token connector (GitHub, Browserbase, …): we create it for the user
      setTokenFor(p);
      setTokenVal("");
      return;
    }
    void oauthFlow(p);
  };

  const submitToken = async () => {
    if (!tokenFor) return;
    if (!tokenVal.trim()) {
      toast("Paste an access token first", "error");
      return;
    }
    setBusyId(tokenFor.id);
    try {
      const added = await ensureAdded(tokenFor, tokenVal);
      if (added) {
        toast(`Connected: ${tokenFor.name}`, "success");
        setTokenFor(null);
        setTokenVal("");
      }
    } finally {
      setBusyId(null);
    }
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
      else {
        toast(`Disconnected: ${n}`, "success");
        setTimeout(refresh, 400);
      }
    } catch {
      toast("Disconnect failed", "error");
    }
  };

  const presetRows = filtered.filter((p) => !connected(p));
  const connectedRows = filtered.filter((p) => connected(p));

  const rowAction = (p: McpPreset) => {
    const live = liveFor(p);
    if (connected(p)) {
      return (
        <span className="flex items-center gap-1.5 text-[12px] text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 px-2.5 py-1.5 rounded-full shrink-0">
          <CheckIcon size={11} /> Connected
        </span>
      );
    }
    if (live) {
      // added but waiting on the user's browser authorization
      return (
        <button
          onClick={() => void oauthFlow(p)}
          disabled={busyId === p.id}
          className="text-[12.5px] font-semibold text-amber-200 bg-amber-500/15 border border-amber-400/40 px-3.5 py-1.5 rounded-full shrink-0 hover:bg-amber-500/25 transition-colors disabled:opacity-50"
        >
          {busyId === p.id ? "Authorizing…" : "Authorize"}
        </button>
      );
    }
    return (
      <button
        onClick={() => openConnect(p)}
        disabled={busyId === p.id}
        className="text-[12.5px] font-semibold text-[#052e16] bg-gradient-to-r from-emerald-400 to-teal-400 px-3.5 py-1.5 rounded-full shrink-0 hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {busyId === p.id ? "Connecting…" : "Connect"}
      </button>
    );
  };

  const renderRow = (p: McpPreset) => (
    <div
      key={p.id}
      className="flex items-center gap-3.5 px-4 py-3 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.02] transition-colors"
    >
      <McpLogo name={p.name} id={p.id} url={p.url} size={36} radius={10} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-white truncate">{p.name}</span>
          <span className="text-[10.5px] text-slate-600 border border-white/[0.08] px-1.5 py-0.5 rounded shrink-0">
            {p.category}
          </span>
        </div>
        <div className="text-[12.5px] text-slate-500 truncate">{p.desc}</div>
      </div>
      {rowAction(p)}
      {connected(p) && (
        <button
          onClick={() => disconnect(String(liveFor(p)?.name || p.name))}
          className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
          title="Disconnect"
        >
          <TrashIcon size={14} />
        </button>
      )}
    </div>
  );

  return (
    <div>
      <Toaster />

      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">Integrations</h2>
        <p className="text-[13px] text-slate-500 mt-0.5">
          Connect the tools you use — one click for {MCP_PRESETS.length} apps. You&apos;ll
          approve access in your browser, then land right back here.
        </p>
      </div>

      {/* pending manual link (only when a popup was blocked) */}
      {pendingUrl && (
        <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-200 flex items-center justify-between gap-3">
          <span>Popup blocked — open the authorization page yourself:</span>
          <a
            href={pendingUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline shrink-0"
            onClick={() => setPendingUrl(null)}
          >
            Open ↗
          </a>
        </div>
      )}

      <div className="relative mb-4">
        <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${MCP_PRESETS.length} integrations…`}
          className="glass-input w-full pl-9 pr-3 py-2.5 rounded-xl text-[13px] text-white placeholder-slate-600"
        />
      </div>

      {connectedRows.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] overflow-hidden mb-5">
          <div className="text-[10px] uppercase tracking-wider text-emerald-500/70 px-4 pt-3 pb-1">
            Connected
          </div>
          {connectedRows.map(renderRow)}
        </div>
      )}

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        {presetRows.length > 0 ? (
          presetRows.map(renderRow)
        ) : (
          <p className="text-slate-600 text-sm text-center py-8">
            No integrations match “{q}”.
          </p>
        )}
      </div>

      {/* live engine entries that aren't presets (custom servers) */}
      {servers.filter((s) => !MCP_PRESETS.some((p) => liveFor(p) === s)).length > 0 && (
        <div className="mt-5">
          <div className="text-[10px] uppercase tracking-wider text-slate-600 mb-2">
            Custom connectors
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            {servers
              .filter((s) => !MCP_PRESETS.some((p) => liveFor(p) === s))
              .map((s: any) => (
                <div
                  key={s.name || s.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] last:border-b-0"
                >
                  <McpLogo name={String(s.name || s.id)} size={36} radius={10} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium text-white truncate">
                      {s.name || s.id}
                    </div>
                    <div className="text-[12px] font-mono text-slate-600 truncate">
                      {String(s.config?.url || (s.config?.command || []).join?.(" ") || "")}
                    </div>
                  </div>
                  <span className="text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <CheckIcon size={10} /> {s.status || "Active"}
                  </span>
                  <button
                    onClick={() => disconnect(s.name || s.id)}
                    className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Disconnect"
                  >
                    <TrashIcon size={13} />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* token connector modal (GitHub etc.) */}
      {tokenFor && (
        <div
          className="fixed inset-0 z-[96] bg-black/70 backdrop-blur-3xl flex items-center justify-center px-4 animate-fade-in"
          onMouseDown={(e) => e.target === e.currentTarget && setTokenFor(null)}
        >
          <div className="w-full max-w-md rounded-2xl bg-[#10141f] border border-white/[0.08] shadow-2xl shadow-black/70 p-5 animate-scale-in">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <McpLogo name={tokenFor.name} id={tokenFor.id} url={tokenFor.url} size={32} radius={9} />
                <span className="text-[15px] font-semibold text-white">
                  Connect {tokenFor.name}
                </span>
              </div>
              <button
                onClick={() => setTokenFor(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <XIcon size={15} />
              </button>
            </div>
            <p className="text-[12.5px] text-slate-500 mb-4">
              Paste a personal access token — Founda wires it into the connector for you.
              {tokenFor.id === "github" && (
                <>
                  {" "}
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,read:org,gist&description=Founda"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:text-emerald-300 underline"
                  >
                    Create a GitHub token ↗
                  </a>
                </>
              )}
            </p>
            <input
              value={tokenVal}
              onChange={(e) => setTokenVal(e.target.value)}
              type="password"
              autoFocus
              placeholder={tokenFor.authHeader?.label || "Access token"}
              className="glass-input w-full px-4 py-2.5 rounded-xl text-sm text-white font-mono placeholder-slate-600 mb-4"
              onKeyDown={(e) => e.key === "Enter" && void submitToken()}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setTokenFor(null)}
                className="px-4 py-2 rounded-lg text-[13px] text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => void submitToken()}
                disabled={busyId === tokenFor.id || !tokenVal.trim()}
                className="glass-btn-primary px-4 py-2 rounded-lg text-[13px] disabled:opacity-50"
              >
                {busyId === tokenFor.id ? "Connecting…" : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { McpPanel };
