"use client";

import { useState, useEffect } from "react";

interface OpenCodeAgent {
  id: string;
  name: string;
  description: string;
  free: boolean;
  source: string;
}

export default function AgentList({ supabase }: { supabase: any }) {
  const [ocAgents, setOcAgents] = useState<OpenCodeAgent[]>([]);
  const [customAgents, setCustomAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [ocLoading, setOcLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseAgent, setBaseAgent] = useState("build");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isAutonomous, setIsAutonomous] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => {
    loadCustomAgents();
    loadOpenCodeAgents();
  }, []);

  const loadOpenCodeAgents = async () => {
    try {
      const res = await fetch("/api/opencode/agents");
      const data = await res.json();
      if (data.agents) setOcAgents(data.agents);
    } catch {
      // fallback
      setOcAgents([
        { id: "build", name: "Build", description: "Default coding agent", free: true, source: "opencode" },
        { id: "plan", name: "Plan", description: "Read-only planning agent", free: true, source: "opencode" },
        { id: "general", name: "General", description: "General assistant", free: true, source: "opencode" },
        { id: "explore", name: "Explore", description: "Codebase search", free: true, source: "opencode" },
      ]);
    } finally {
      setOcLoading(false);
    }
  };

  const loadCustomAgents = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("agents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setCustomAgents(data);
    setLoading(false);
  };

  const createAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("agents").insert({
      user_id: user.id,
      name,
      description,
      model: baseAgent,
      system_prompt: systemPrompt,
      is_autonomous: isAutonomous,
    });

    if (error) { alert(error.message); return; }
    resetForm();
    loadCustomAgents();
  };

  const updateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const { error } = await supabase
      .from("agents")
      .update({ name, description, model: baseAgent, system_prompt: systemPrompt, is_autonomous: isAutonomous })
      .eq("id", editing.id);
    if (error) { alert(error.message); return; }
    resetForm();
    loadCustomAgents();
  };

  const deleteAgent = async (id: string) => {
    if (!confirm("Delete this agent?")) return;
    await supabase.from("agents").delete().eq("id", id);
    loadCustomAgents();
  };

  const startEdit = (agent: any) => {
    setEditing(agent);
    setName(agent.name);
    setDescription(agent.description || "");
    setBaseAgent(agent.model || "build");
    setSystemPrompt(agent.system_prompt || "");
    setIsAutonomous(agent.is_autonomous);
    setShowCreate(true);
  };

  const resetForm = () => {
    setEditing(null); setName(""); setDescription("");
    setBaseAgent("build"); setSystemPrompt(""); setIsAutonomous(false);
    setShowCreate(false);
  };

  if (loading && ocLoading) return <div className="text-gray-400">Loading agents...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Agents</h2>
        <button
          onClick={() => (editing ? resetForm() : setShowCreate(!showCreate))}
          className="text-sm bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg text-white"
        >
          {showCreate ? "Cancel" : "+ New Agent"}
        </button>
      </div>

      {/* Free opencode agents */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-3">
          Free opencode Agents <span className="text-emerald-400 text-xs">Built-in · No API key needed</span>
        </h3>
        <div className="grid md:grid-cols-4 gap-3">
          {ocAgents.map((agent) => (
            <div key={agent.id} className="bg-gray-900 border border-emerald-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-white text-sm">{agent.name}</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">FREE</span>
              </div>
              <p className="text-xs text-gray-500">{agent.description}</p>
              <code className="text-[10px] text-gray-600 mt-1 block">{agent.id}</code>
            </div>
          ))}
          {ocAgents.length === 0 && (
            <div className="col-span-4 text-sm text-gray-500 py-4 text-center bg-gray-900 rounded-xl border border-gray-800">
              Starting opencode... agents will appear shortly.
            </div>
          )}
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={editing ? updateAgent : createAgent} className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 space-y-3">
          <h3 className="font-medium text-white mb-2">{editing ? "Edit Agent" : "Create Custom Agent"}</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name" required
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description"
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white" />
            <select value={baseAgent} onChange={(e) => setBaseAgent(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              {ocAgents.map((a) => (
                <option key={a.id} value={a.id}>{a.name} (free)</option>
              ))}
            </select>
            <label className="flex items-center gap-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white">
              <input type="checkbox" checked={isAutonomous} onChange={(e) => setIsAutonomous(e.target.checked)} className="rounded" />
              Autonomous mode
            </label>
          </div>
          <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="System prompt / instructions..." rows={4}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono" />
          <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm text-white">
            {editing ? "Update Agent" : "Create Agent"}
          </button>
        </form>
      )}

      {/* Custom agents */}
      <div className="grid md:grid-cols-2 gap-4">
        {customAgents.length === 0 && !showCreate && (
          <div className="col-span-2 text-center py-8 bg-gray-900 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-sm">No custom agents. Use the free built-in agents above or create your own.</p>
          </div>
        )}
        {customAgents.map((agent) => (
          <div key={agent.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-medium text-white flex items-center gap-2">
                  {agent.name}
                  {agent.is_autonomous && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">Autonomous</span>
                  )}
                </div>
                <div className="text-sm text-gray-500">Based on: {agent.model}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(agent)} className="text-xs px-3 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300">Edit</button>
                <button onClick={() => deleteAgent(agent.id)} className="text-xs px-3 py-1 bg-gray-800 hover:bg-red-900/30 border border-gray-700 rounded-lg text-red-400">Delete</button>
              </div>
            </div>
            {agent.description && <p className="text-sm text-gray-400 mb-2">{agent.description}</p>}
            {agent.system_prompt && (
              <pre className="text-xs text-gray-500 bg-gray-800/50 rounded-lg p-3 overflow-hidden max-h-24 whitespace-pre-wrap">{agent.system_prompt}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}