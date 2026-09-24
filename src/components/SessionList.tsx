"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

interface Session {
  id: string;
  title: string;
  agent_name: string;
  message_count: number;
  updated_at: string;
}

export default function SessionList({ supabase }: { supabase: any }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [agentName, setAgentName] = useState("build");
  const [importData, setImportData] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadSessions(); }, []);

  const loadSessions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false });
    if (data) setSessions(data);
    setLoading(false);
  };

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        title: title || "New Chat",
        agent_name: agentName,
        state: { messages: [] },
        message_count: 0,
      })
      .select()
      .single();

    if (data) {
      window.location.href = `/sessions/${data.id}`;
    } else if (error) {
      alert(error.message);
      setCreating(false);
    }
  };

  const quickChat = async () => {
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        title: "New Chat",
        agent_name: agentName,
        state: { messages: [] },
        message_count: 0,
      })
      .select()
      .single();
    if (data) window.location.href = `/sessions/${data.id}`;
    else setCreating(false);
  };

  const importSession = async () => {
    try {
      const parsed = JSON.parse(importData);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("sessions").insert({
        user_id: user.id,
        title: parsed.title || "Imported Chat",
        agent_name: parsed.agent_name || "build",
        model: parsed.model || null,
        system_prompt: parsed.system_prompt || null,
        state: parsed.state || { messages: [] },
        message_count: parsed.state?.messages?.length || 0,
        tags: parsed.tags || [],
        version: parsed.version || 1,
      });
      if (error) { alert(`Import failed: ${error.message}`); return; }
      setImportData(""); setShowCreate(false); loadSessions();
      alert("Session imported!");
    } catch { alert("Invalid JSON"); }
  };

  const exportSession = async (session: Session) => {
    const { data } = await supabase.from("sessions").select("*").eq("id", session.id).single();
    if (!data) return;
    const exportObj = {
      version: data.version || 1, title: data.title, agent_name: data.agent_name,
      model: data.model, system_prompt: data.system_prompt, state: data.state,
      message_count: data.message_count, tags: data.tags,
      exported_at: new Date().toISOString(), source: "founda-crm",
    };
    await supabase.from("session_exports").insert({
      session_id: session.id, user_id: data.user_id,
      version: (data.version || 1) + 1, export_data: exportObj, format: "json",
    });
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${session.title.replace(/\s+/g, "_")}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-gray-400">Loading chats...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Chats</h2>
        <div className="flex gap-2">
          <button onClick={quickChat} disabled={creating}
            className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg text-white">
            {creating ? "..." : "⚡ Quick Chat"}
          </button>
          <button onClick={() => setShowCreate(!showCreate)}
            className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 rounded-lg text-gray-300">
            {showCreate ? "Cancel" : "+ New"}
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <form onSubmit={createSession} className="space-y-3 mb-4">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chat title"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
            <select value={agentName} onChange={(e) => setAgentName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <option value="build">🔧 Build (free)</option>
              <option value="plan">📋 Plan (free)</option>
              <option value="general">💬 General (free)</option>
              <option value="explore">🔍 Explore (free)</option>
            </select>
            <button type="submit" disabled={creating}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg text-sm text-white">
              {creating ? "Creating..." : "Create & Chat"}
            </button>
          </form>
          <div className="border-t border-gray-800 pt-4">
            <h3 className="text-sm font-medium text-white mb-2">Import Session</h3>
            <textarea value={importData} onChange={(e) => setImportData(e.target.value)}
              placeholder='{"title": "...", "state": {"messages": [...]}}' rows={3}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs font-mono text-white" />
            <button onClick={importSession} disabled={!importData}
              className="mt-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg text-xs text-white">
              Import
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sessions.length === 0 && (
          <div className="text-center py-16 bg-gray-900 rounded-xl border border-gray-800">
            <p className="text-gray-500 mb-1">No chats yet.</p>
            <p className="text-sm text-gray-600">Start a quick chat or create a new session.</p>
          </div>
        )}
        {sessions.map((session) => (
          <div key={session.id}
            className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-indigo-500/30 transition-colors group">
            <Link href={`/sessions/${session.id}`} className="flex-1 min-w-0">
              <div className="font-medium text-white truncate group-hover:text-indigo-400 transition-colors">
                {session.title}
              </div>
              <div className="text-sm text-gray-500">
                {session.agent_name} · {session.message_count} msgs ·{" "}
                {new Date(session.updated_at).toLocaleDateString()}
              </div>
            </Link>
            <div className="flex items-center gap-2 ml-4">
              <button onClick={() => exportSession(session)}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">
                Export
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}