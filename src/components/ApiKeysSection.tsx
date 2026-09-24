"use client";

import { useState, useEffect } from "react";

const PROVIDERS = [
  { id: "anthropic", name: "Anthropic", models: "Claude Sonnet 4, Haiku 4, Opus 4", paid: true },
  { id: "openai", name: "OpenAI", models: "GPT-4o, GPT-4o Mini", paid: true },
  { id: "google", name: "Google", models: "Gemini 2.0 Flash", paid: true },
  { id: "deepseek", name: "DeepSeek", models: "DeepSeek Chat, Coder", paid: true },
  { id: "groq", name: "Groq", models: "Llama 3, Mixtral (free tier)", paid: false },
  { id: "mistral", name: "Mistral", models: "Mistral Small (free tier)", paid: false },
  { id: "opencode", name: "opencode (Built-in)", models: "Free agents, no API key needed", paid: false },
];

export default function ApiKeysSection() {
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [opencodeStatus, setOpencodeStatus] = useState<any>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    checkOpencode();
  }, []);

  const checkOpencode = async () => {
    try {
      const res = await fetch("/api/opencode/install");
      const data = await res.json();
      setOpencodeStatus(data);
    } catch {}
  };

  const installOpencode = async (action: string) => {
    setInstalling(true);
    try {
      const res = await fetch("/api/opencode/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      alert(data.message || (data.success ? "Done!" : "Failed"));
      checkOpencode();
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setInstalling(false);
    }
  };

  const saveKey = async (providerID: string) => {
    const key = keys[providerID];
    if (!key) return;
    setLoading(providerID);
    try {
      const res = await fetch("/api/opencode/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_key", providerID, apiKey: key }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved((p) => ({ ...p, [providerID]: true }));
        setKeys((p) => ({ ...p, [providerID]: "" }));
      } else {
        alert(data.error || "Failed to save key");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setLoading(null);
    }
  };

  const removeKey = async (providerID: string) => {
    if (!confirm(`Remove API key for ${providerID}?`)) return;
    setLoading(providerID);
    try {
      await fetch("/api/opencode/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_key", providerID }),
      });
      setSaved((p) => ({ ...p, [providerID]: false }));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* opencode status */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              opencode Engine
              {opencodeStatus?.installed && (
                <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  v{opencodeStatus.version || "installed"}
                </span>
              )}
              {!opencodeStatus?.installed && (
                <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                  Not installed
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              opencode powers all free agents. Auto-installs and auto-updates.
            </p>
          </div>
          <div className="flex gap-2">
            {!opencodeStatus?.installed && (
              <button onClick={() => installOpencode("install")} disabled={installing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-sm text-white">
                {installing ? "Installing..." : "Install opencode"}
              </button>
            )}
            {opencodeStatus?.installed && (
              <button onClick={() => installOpencode("upgrade")} disabled={installing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg text-sm text-white">
                {installing ? "Upgrading..." : "Upgrade to Latest"}
              </button>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-600">
          <code>curl -fsSL https://opencode.ai/install | bash</code>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="font-semibold text-white mb-1">External Model API Keys</h3>
        <p className="text-sm text-gray-500 mb-4">
          Optional — connect your own API keys to use paid models. Free opencode agents work without any keys.
        </p>
        <div className="space-y-3">
          {PROVIDERS.map((provider) => (
            <div key={provider.id} className="flex items-center gap-4 p-4 bg-gray-800/50 border border-gray-700 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-sm">{provider.name}</span>
                  {provider.paid ? (
                    <span className="text-[10px] bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded-full">Paid</span>
                  ) : (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">Free tier</span>
                  )}
                  {saved[provider.id] && (
                    <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">Connected</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{provider.models}</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={keys[provider.id] || ""}
                  onChange={(e) => setKeys((p) => ({ ...p, [provider.id]: e.target.value }))}
                  placeholder={saved[provider.id] ? "••••••••" : "Enter API key"}
                  className="w-48 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-xs text-white font-mono"
                />
                <button
                  onClick={() => saveKey(provider.id)}
                  disabled={loading === provider.id || !keys[provider.id]}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg text-xs text-white"
                >
                  {loading === provider.id ? "..." : "Save"}
                </button>
                {saved[provider.id] && (
                  <button
                    onClick={() => removeKey(provider.id)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-red-900/30 rounded-lg text-xs text-red-400"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}