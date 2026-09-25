"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth, loadGuestSessions, saveGuestSession } from "@/lib/auth";
import { trackUsage, canSend, loadUsage, UsagePanel, useToast } from "@/components/UsagePanel";
import {
  WrenchIcon, ClipboardIcon, MessageIcon, SearchIcon, BotIcon,
  ImageIcon, MicIcon, SendIcon, CopyIcon, RefreshIcon, ThumbsUpIcon,
  AlertIcon, ArrowLeftIcon, ChevronDownIcon, CheckIcon,
  ShieldIcon, DownloadIcon, TrashIcon, LayersIcon, BarChartIcon,
} from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { CommandPalette, type PaletteAction } from "@/components/palette";
import { buildAuditPrompt } from "@/lib/skills";

interface Message {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  image?: string;
  metadata?: any;
}

const AGENTS = [
  { id: "build", name: "Build", icon: <WrenchIcon size={15} />, grad: "from-emerald-500 to-teal-600", dot: "bg-emerald-400", ring: "text-emerald-400", border: "border-l-emerald-400/70" },
  { id: "plan", name: "Plan", icon: <ClipboardIcon size={15} />, grad: "from-amber-500 to-orange-600", dot: "bg-amber-400", ring: "text-amber-400", border: "border-l-amber-400/70" },
  { id: "general", name: "General", icon: <MessageIcon size={15} />, grad: "from-sky-500 to-blue-600", dot: "bg-sky-400", ring: "text-sky-400", border: "border-l-sky-400/70" },
  { id: "explore", name: "Explore", icon: <SearchIcon size={15} />, grad: "from-violet-500 to-indigo-600", dot: "bg-violet-400", ring: "text-violet-400", border: "border-l-teal-400/70" },
];

const SUGGESTIONS = [
  "Explain this codebase to me",
  "Write a REST API in Node.js",
  "Find bugs in my code",
  "Create a README for my project",
  "Refactor this function for performance",
  "Add tests to my component",
];

const COMMANDS = [
  { cmd: "/clear", desc: "Clear this conversation" },
  { cmd: "/help", desc: "List all commands" },
  { cmd: "/audit", desc: "Run a security audit (args: scope or pasted code)", arg: true },
  { cmd: "/model", desc: "Set model — /model pollinations/openai-fast", arg: true },
  { cmd: "/agent", desc: "Switch agent — /agent plan", arg: true },
  { cmd: "/export", desc: "Export chat — /export json | md", arg: true },
];

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const isGuest = searchParams.get("guest") === "1";

  const { user, guest, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeAgent, setActiveAgent] = useState("build");
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [model, setModel] = useState<string>("");
  const [cmdIdx, setCmdIdx] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [supabase, setSupabase] = useState<any>(null);
  const { toast, Toaster } = useToast();

  useEffect(() => {
    import("@/lib/supabase-browser").then(({ createSupabaseBrowserClient }) => {
      setSupabase(createSupabaseBrowserClient());
    }).catch(() => {});
    setVoiceSupported(
      typeof window !== "undefined" &&
        ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    );
    const usage = loadUsage();
    if (usage.messagesUsed >= usage.dailyLimit) setLimitReached(true);
  }, []);

  const showCmdList = input.startsWith("/") && !sending;
  const filteredCmds = showCmdList
    ? COMMANDS.filter((c) => c.cmd.startsWith(input.split(/\s/)[0]))
    : [];

  useEffect(() => setCmdIdx(0), [input]);

  // Cmd/Ctrl+K command palette
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // Load messages (server-backed store for guests — hydrate first)
  useEffect(() => {
    if (isGuest || guest) {
      import("@/lib/store").then(async (store) => {
        store.ensureInit("guest");
        await store.ready();
        const session = loadGuestSessions().find((s) => s.id === sessionId);
        if (session) {
          setMessages(session.messages || []);
          setActiveAgent(session.agent || "build");
        }
      }).catch(() => {});
    } else if (supabase && user) {
      loadAccountSession();
    }
  }, [supabase, user, isGuest, guest, sessionId]);

  const loadAccountSession = async () => {
    if (!supabase || !user) return;
    try {
      const { data } = await supabase
        .from("sessions").select("*")
        .eq("id", sessionId).eq("user_id", user.id).single();
      if (data) {
        setMessages(data.state?.messages || []);
        setActiveAgent(data.agent_name || "build");
      }
    } catch {}
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const saveMessages = async (updated: Message[]) => {
    if (isGuest || guest) {
      const sessions = loadGuestSessions();
      const idx = sessions.findIndex((s) => s.id === sessionId);
      if (idx >= 0) {
        sessions[idx].messages = updated;
        sessions[idx].agent = activeAgent;
        saveGuestSession(sessions[idx]);
      }
    } else if (supabase && user) {
      try {
        await supabase.from("sessions").update({
          state: { messages: updated },
          message_count: updated.length,
          agent_name: activeAgent,
          updated_at: new Date().toISOString(),
        }).eq("id", sessionId);
      } catch {}
    }
  };

  const exportChat = (format: string) => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const name = `founda-chat-${stamp}`;
    let blob: Blob;
    let ext: string;
    if (format === "md") {
      const md = messages
        .map((m) => `**${m.role === "user" ? "You" : activeAgentMeta?.name || "Assistant"}**:\n\n${m.content}`)
        .join("\n\n---\n\n");
      blob = new Blob([`# Founda chat\n\n${md}\n`], { type: "text/markdown" });
      ext = "md";
    } else {
      blob = new Blob([JSON.stringify({ sessionId, model, agent: activeAgent, messages }, null, 2)], {
        type: "application/json",
      });
      ext = "json";
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`Exported .${ext}`, "success");
  };

  const runSlash = async (cmd: string, arg: string) => {
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (cmd === "/clear") {
      setMessages([]);
      await saveMessages([]);
      toast("Conversation cleared", "success");
      return;
    }
    if (cmd === "/help") {
      const list = COMMANDS.map((c) => `**${c.cmd}** — ${c.desc}`).join("\n");
      const help: Message = { role: "assistant", content: `### Commands\n\n${list}\n\nTip: press **⌘K** (Ctrl+K) for the command palette.` };
      const withMsg = [...messages, help];
      setMessages(withMsg);
      await saveMessages(withMsg);
      return;
    }
    if (cmd === "/model") {
      if (!arg) { toast(model ? `Current: ${model}` : "Using default model. Usage: /model pollinations/openai-fast", "success"); return; }
      setModel(arg);
      toast(`Model set to ${arg}`, "success");
      return;
    }
    if (cmd === "/agent") {
      const a = AGENTS.find((x) => x.id === arg.toLowerCase() || x.name.toLowerCase() === arg.toLowerCase());
      if (a) { setActiveAgent(a.id); toast(`Agent: ${a.name}`, "success"); }
      else toast(`Agents: ${AGENTS.map((x) => x.id).join(", ")}`, "error");
      return;
    }
    if (cmd === "/export") {
      exportChat(arg === "md" || arg === "markdown" ? "md" : "json");
      return;
    }
    if (cmd === "/audit") {
      await sendMessage({
        prompt: buildAuditPrompt(arg),
        label: arg ? `/audit ${arg}` : "/audit this codebase",
      });
    }
  };

  const sendMessage = async (opts?: { prompt?: string; label?: string; systemPrompt?: string }) => {
    const overridePrompt = opts?.prompt;
    const body = overridePrompt ?? input.trim();
    if ((!body && !attachedImage) || sending) return;
    if (!canSend()) {
      setLimitReached(true);
      toast("Daily limit reached. Resets at midnight.", "error");
      return;
    }

    const userMsg: Message = {
      role: "user",
      content: opts?.label || body,
      image: overridePrompt ? undefined : attachedImage || undefined,
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    if (!overridePrompt) setInput("");
    setAttachedImage(null);
    setSending(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    await saveMessages(updated);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: isGuest ? null : sessionId,
          prompt: overridePrompt || userMsg.content,
          agent: activeAgent,
          ...(model ? { model } : {}),
          ...(opts?.systemPrompt ? { systemPrompt: opts.systemPrompt } : {}),
        }),
      });
      const data = await res.json();
      const reply: Message = data.error
        ? { role: "assistant", content: `Error: ${data.error}` }
        : { role: "assistant", content: data.content || "(empty response)", metadata: data.metadata };

      const withReply = [...updated, reply];
      setMessages(withReply);
      await saveMessages(withReply);

      const estTokens = Math.ceil((userMsg.content.length + reply.content.length) / 4);
      const usage = trackUsage(1, estTokens);
      if (usage.messagesUsed >= usage.dailyLimit) setLimitReached(true);
    } catch (err: any) {
      const withErr = [...updated, { role: "assistant" as const, content: `Error: ${err.message}` }];
      setMessages(withErr);
      await saveMessages(withErr);
    } finally {
      setSending(false);
    }
  };

  const toggleVoice = () => {
    if (!voiceSupported) { toast("Voice not supported in this browser", "error"); return; }
    if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setInput(t);
    };
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => setIsRecording(false);
    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast("Image must be under 10MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const copyMsg = (c: string, idx: number) => {
    navigator.clipboard.writeText(c);
    setCopiedIdx(idx);
    toast("Copied", "success");
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const regenerate = async () => {
    if (sending || messages.length < 2) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    setMessages(messages.slice(0, -1));
    if (lastUser) { setInput(lastUser.content); setTimeout(() => sendMessage(), 50); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showCmdList && filteredCmds.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setCmdIdx((i) => (i + 1) % filteredCmds.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setCmdIdx((i) => (i - 1 + filteredCmds.length) % filteredCmds.length); return; }
      if (e.key === "Tab") { e.preventDefault(); setInput(filteredCmds[cmdIdx].cmd + " "); return; }
      if (e.key === "Escape") { e.preventDefault(); setInput(""); return; }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const sel = filteredCmds[cmdIdx];
        const rest = input.slice(sel.cmd.length).trim();
        if (input.split(/\s/)[0] === sel.cmd) runSlash(sel.cmd, rest);
        else setInput(sel.cmd + " ");
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const activeAgentMeta = AGENTS.find((a) => a.id === activeAgent);

  const paletteActions: PaletteAction[] = [
    { id: "new", group: "Chat", label: "New chat", hint: "start fresh", icon: <MessageIcon size={14} />, run: () => router.push(`/sessions/${crypto.randomUUID()}${isGuest || guest ? "?guest=1" : ""}`) },
    { id: "audit", group: "Chat", label: "Run security audit", hint: "/audit", icon: <ShieldIcon size={14} />, run: () => runSlash("/audit", "") },
    { id: "export-json", group: "Chat", label: "Export chat as JSON", hint: "/export json", icon: <DownloadIcon size={14} />, run: () => exportChat("json") },
    { id: "export-md", group: "Chat", label: "Export chat as Markdown", hint: "/export md", icon: <DownloadIcon size={14} />, run: () => exportChat("md") },
    { id: "clear", group: "Chat", label: "Clear conversation", hint: "/clear", icon: <TrashIcon size={14} />, run: () => runSlash("/clear", "") },
    ...AGENTS.map((a) => ({
      id: `agent-${a.id}`,
      group: "Agents",
      label: `Switch to ${a.name}`,
      hint: `/agent ${a.id}`,
      icon: a.icon as React.ReactNode,
      run: () => { setActiveAgent(a.id); toast(`Agent: ${a.name}`, "success"); },
    })),
    { id: "help", group: "Navigation", label: "Show commands help", hint: "/help", icon: <ClipboardIcon size={14} />, run: () => runSlash("/help", "") },
    { id: "dashboard", group: "Navigation", label: "Go to dashboard", hint: "sessions & settings", icon: <LayersIcon size={14} />, run: () => router.push("/dashboard") },
    { id: "usage", group: "Navigation", label: "Toggle usage panel", hint: "limits & quota", icon: <BarChartIcon size={14} />, run: () => setShowUsage((v) => !v) },
  ];

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      <Toaster />

      {/* Header */}
      <header className="glass-strong hairline-b px-3 sm:px-4 py-2.5 flex items-center justify-between shrink-0 relative z-20">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/dashboard")}
            className="glass-btn p-2 rounded-lg text-slate-400 hover:text-white" title="Back">
            <ArrowLeftIcon size={15} />
          </button>
          <div className="hidden sm:block min-w-0">
            <div className="text-[13px] font-medium text-white truncate max-w-[280px]">
              {messages.length > 0 && messages[0].content ? messages[0].content.slice(0, 40) + "…" : <span className="gradient-text font-semibold">New chat</span>}
            </div>
            <div className="text-[10px] text-slate-600">{messages.length} messages</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Agent picker */}
          <div className="relative">
            <button onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="glass-btn flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] text-white">
              <span className={`h-2 w-2 rounded-full ${activeAgentMeta?.dot || "bg-emerald-400"} shadow-[0_0_8px_currentColor]`} />
              {activeAgentMeta?.icon}
              <span className="hidden sm:inline">{activeAgentMeta?.name}</span>
              <ChevronDownIcon size={12} className="text-slate-500" />
            </button>
            {showAgentPicker && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/10 bg-[#101a30]/95 backdrop-blur-xl shadow-2xl shadow-emerald-950/50 z-50 py-1.5 animate-scale-in overflow-hidden">
                <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-slate-600">Free agents</div>
                {AGENTS.map((a) => (
                  <button key={a.id}
                    onClick={() => { setActiveAgent(a.id); setShowAgentPicker(false); }}
                    className={`w-full text-left px-4 py-2 hover:bg-emerald-500/10 flex items-center gap-3 transition-colors ${
                      activeAgent === a.id ? "text-white bg-emerald-500/[0.08]" : "text-slate-400"
                    }`}>
                    <span className={`h-6 w-6 rounded-md bg-gradient-to-br ${a.grad} flex items-center justify-center text-white shrink-0`}>
                      {a.icon}
                    </span>
                    <div>
                      <div className="text-[13px] font-medium">{a.name}</div>
                      <div className="text-[10px] text-slate-600">{a.id}</div>
                    </div>
                    {activeAgent === a.id && <CheckIcon size={13} className="ml-auto text-emerald-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setShowUsage(!showUsage)}
            className="glass-btn p-2 rounded-lg text-slate-400 hover:text-white" title="Usage">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Usage sidebar */}
      {showUsage && (
        <div className="absolute right-2 top-16 z-40 w-80 animate-slide-right">
          <UsagePanel />
        </div>
      )}

      {/* Limit banner */}
      {limitReached && (
        <div className="bg-amber-500/[0.08] border-b border-amber-500/20 px-4 py-2.5 text-[13px] text-amber-200 flex items-center justify-center gap-2 animate-fade-in">
          <AlertIcon size={13} className="text-amber-400" />
          Daily message limit reached. Resets at midnight.
          <Link href="/register" className="underline text-white">Upgrade</Link>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-up">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 shadow-lg shadow-teal-500/30 flex items-center justify-center mb-5 text-white">
                <BotIcon size={24} />
              </div>
              <h2 className="font-display text-xl font-semibold mb-2 gradient-text">What can I help with?</h2>
              <p className="text-slate-500 text-sm mb-8 max-w-md">
                Chat with your free opencode agent. Voice input, images, and persistent memory available.
              </p>
              <div className="grid sm:grid-cols-2 gap-2.5 max-w-xl w-full">
                {SUGGESTIONS.map((s, i) => (
                  <button key={s} onClick={() => setInput(s)}
                    className={`rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-emerald-500/[0.08] hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/10 p-3.5 text-left text-[13px] text-slate-400 hover:text-white transition-all animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className="mb-5 group animate-message-in">
              <div className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-semibold ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-600/30"
                    : `bg-gradient-to-br ${activeAgentMeta?.grad || "from-teal-500 to-emerald-600"} text-white shadow-md`
                }`}>
                  {msg.role === "user" ? "You" : <BotIcon size={14} />}
                </div>

                <div className={`flex-1 min-w-0 ${msg.role === "user" ? "flex justify-end" : ""}`}>
                  <div className={`inline-block max-w-full rounded-2xl px-4 py-3 text-[14px] ${
                    msg.role === "user"
                      ? "msg-user"
                      : `msg-bot border-l-2 ${activeAgentMeta?.border || "border-l-teal-400/70"}`
                  }`}>
                    {msg.image && <img src={msg.image} alt="attached" className="max-w-xs rounded-lg mb-2 border border-white/15" />}
                    {msg.role === "assistant" ? (
                      <Markdown content={msg.content} />
                    ) : (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">{msg.content}</div>
                    )}
                  </div>

                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={() => copyMsg(msg.content, i)}
                        className="p-1.5 rounded-md text-slate-600 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors" title="Copy">
                        {copiedIdx === i ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                      </button>
                      <button onClick={regenerate} disabled={sending}
                        className="p-1.5 rounded-md text-slate-600 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-30" title="Regenerate">
                        <RefreshIcon size={13} />
                      </button>
                      <button onClick={() => copyMsg(msg.content, i)}
                        className="p-1.5 rounded-md text-slate-600 hover:text-amber-300 hover:bg-teal-500/10 transition-colors" title="Good response">
                        <ThumbsUpIcon size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-3 mb-5 animate-message-in">
              <div className={`shrink-0 h-7 w-7 rounded-lg bg-gradient-to-br ${activeAgentMeta?.grad || "from-teal-500 to-emerald-600"} flex items-center justify-center text-white shadow-md`}>
                <BotIcon size={14} />
              </div>
              <div className="msg-bot rounded-2xl px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full typing-dot" />
                  <div className="w-1.5 h-1.5 bg-amber-300 rounded-full typing-dot" />
                  <div className="w-1.5 h-1.5 bg-sky-400 rounded-full typing-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {paletteOpen && <CommandPalette actions={paletteActions} onClose={() => setPaletteOpen(false)} />}

      {/* Input */}
      <div className="border-t border-white/[0.08] bg-[#0b1120]/90 backdrop-blur-xl px-4 py-3 shrink-0 relative z-10">
        <div className="max-w-3xl mx-auto relative">
          {showCmdList && filteredCmds.length > 0 && (
            <div className="absolute bottom-full mb-2 left-0 right-0 rounded-xl border border-white/10 bg-[#0e1628]/95 backdrop-blur-xl shadow-2xl shadow-black/50 py-1.5 overflow-hidden animate-scale-in z-30">
              <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-slate-600">Commands</div>
              {filteredCmds.map((c, i) => (
                <button key={c.cmd}
                  onMouseEnter={() => setCmdIdx(i)}
                  onClick={() => {
                    if (input.split(/\s/)[0] === c.cmd) runSlash(c.cmd, input.slice(c.cmd.length).trim());
                    else setInput(c.cmd + " ");
                  }}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${i === cmdIdx ? "bg-emerald-500/[0.1] text-white" : "text-slate-400"}`}>
                  <span className={`font-mono text-[12.5px] ${i === cmdIdx ? "text-emerald-300" : "text-slate-500"}`}>{c.cmd}</span>
                  <span className="text-[12px] text-slate-600 truncate">{c.desc}</span>
                </button>
              ))}
            </div>
          )}
          {attachedImage && (
            <div className="mb-2 relative inline-block animate-scale-in">
              <img src={attachedImage} alt="preview" className="h-20 rounded-xl border border-emerald-400/30 shadow-lg shadow-emerald-600/20" />
              <button onClick={() => setAttachedImage(null)}
                className="absolute -top-2 -right-2 h-5 w-5 bg-gradient-to-br from-emerald-500 to-teal-500 text-white rounded-full flex items-center justify-center text-xs hover:brightness-110 transition font-medium">×</button>
            </div>
          )}

          <div className="glass-input flex items-end gap-2 rounded-2xl px-3 py-2 focus-within:border-emerald-400/50 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.15),0_0_28px_rgba(139,92,246,0.18)]">
            <button onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg text-slate-500 hover:text-amber-300 transition-colors shrink-0" title="Upload image">
              <ImageIcon size={18} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />

            <textarea ref={textareaRef} value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={`Message ${activeAgentMeta?.name}…`}
              rows={1} disabled={sending || limitReached}
              className="flex-1 bg-transparent resize-none text-sm text-white placeholder-slate-600 focus:outline-none max-h-[200px] py-1.5" />

            <button onClick={toggleVoice}
              className={`p-2 rounded-lg transition-all shrink-0 ${
                isRecording ? "bg-red-500/15 text-red-400 animate-pulse" : "text-slate-500 hover:text-sky-300"
              }`} title="Voice input">
              <MicIcon size={18} />
            </button>

            <button onClick={() => sendMessage()}
              disabled={sending || (!input.trim() && !attachedImage) || limitReached}
              className={`p-2.5 rounded-xl transition-all shrink-0 ${
                sending || (!input.trim() && !attachedImage) || limitReached
                  ? "bg-white/[0.06] text-slate-700"
                  : "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-600/35 hover:brightness-110 hover:shadow-teal-500/40 active:scale-95"
              }`} title="Send (Enter)">
              <SendIcon size={17} />
            </button>
          </div>

          <div className="flex items-center justify-between mt-2 px-1">
            <div className="text-[10px] text-slate-700">
              {isRecording ? <span className="text-red-400 animate-pulse">Recording…</span> :
                <>Enter send · / commands · ⌘K palette{voiceSupported && " · voice"}</>}
            </div>
            <div className="text-[10px] gradient-text font-medium">Powered by opencode</div>
          </div>
        </div>
      </div>
    </div>
  );
}
