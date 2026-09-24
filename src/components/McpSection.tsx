"use client";

import { useState, useEffect } from "react";

export default function McpSection() {
  const [servers, setServers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [transport, setTransport] = useState<"stdio" | "http" | "sse">("stdio");
  const [command, setCommand] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [ocStatus, setOcStatus] = useState<any[]>([]);

  useEffect(() => {
    loadServers();
    loadOcStatus();
  }, []);

  const loadServers = async () => {
    try {
      const res = await fetch("/api/opencode/mcp");
      const data = await res.json();
      if (data.servers) setOcStatus(Array.isArray(data.servers) ? data.servers : []);
    } catch {}
  };

  const loadOcStatus = async () => {
    try {
      const res = await fetch("/api/opencode/mcp");
      const data = await res.json();
      if (data.servers && Array.isArray(data.servers)) setOcStatus(data.servers);
    } catch {}
  };

  const addServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const config =
        transport === "stdio"
          ? { type: "local", command, args: [], env: {} }
          : { type: "remote", url };

      const res = await fetch("/api/opencode/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", name, config }),
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setName(""); setCommand(""); setUrl("");
        setShowAdd(false);
        loadServers();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">MCP Servers</h2>
          <p className="text-sm text-gray-500">Connect MCP tools your agents can use — web search, GitHub, filesystem, and more.</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-sm bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-white"
        >
          {showAdd ? "Cancel" : "+ Add Server"}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={addServer} className="space-y-3 mb-6 p-4 bg-gray-800 rounded-lg">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Server name (e.g. github, websearch)" required
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white" />
          <select value={transport} onChange={(e) => setTransport(e.target.value as any)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white">
            <option value="stdio">stdio (local command)</option>
            <option value="http">http (remote URL)</option>
            <option value="sse">sse (remote URL)</option>
          </select>
          {transport === "stdio" && (
            <input value={command} onChange={(e) => setCommand(e.target.value)}
              placeholder="Command (e.g. npx -y @modelcontextprotocol/server-github)"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white font-mono" />
          )}
          {transport !== "stdio" && (
            <input value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="URL (e.g. https://mcp.example.com/sse)"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white font-mono" />
          )}
          <button type="submit" disabled={loading}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg text-sm text-white">
            {loading ? "Adding..." : "Add MCP Server"}
          </button>
        </form>
      )}

      <div className="space-y-2">
        {ocStatus.length === 0 && servers.length === 0 && (
          <p className="text-gray-500 text-sm">No MCP servers configured.</p>
        )}
        {ocStatus.map((s: any, i: number) => (
          <div key={i} className="flex items-center justify-between p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
            <div>
              <div className="font-medium text-sm text-white">{s.name || s.id}</div>
              <div className="text-xs text-gray-500">{s.type || "connected"}</div>
            </div>
            <span className="text-xs text-emerald-400">Active</span>
          </div>
        ))}
      </div>

      {/* Quick add popular MCP servers */}
      <div className="mt-6 pt-4 border-t border-gray-800">
        <h4 className="text-sm font-medium text-gray-400 mb-3">Quick Add</h4>
        <div className="grid md:grid-cols-3 gap-2">
          {[
            { name: "github", cmd: "npx -y @modelcontextprotocol/server-github" },
            { name: "filesystem", cmd: "npx -y @modelcontextprotocol/server-filesystem /public" },
            { name: "websearch", cmd: "npx -y @modelcontextprotocol/server-brave-search" },
          ].map((preset) => (
            <button key={preset.name} onClick={() => { setName(preset.name); setCommand(preset.cmd); setShowAdd(true); }}
              className="text-left p-3 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-indigo-500/50 transition-colors">
              <div className="text-sm text-white font-medium">{preset.name}</div>
              <div className="text-[10px] text-gray-500 font-mono truncate">{preset.cmd}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}