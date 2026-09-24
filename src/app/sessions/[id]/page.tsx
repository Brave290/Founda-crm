"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth, loadGuestSessions, saveGuestSession } from "@/lib/auth";
import { trackUsage, canSend, loadUsage, UsagePanel, useToast } from "@/components/UsagePanel";

interface Message {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  image?: string;
  metadata?: any;
}

const AGENTS = [
  { id: "build", name: "Build", icon: "🔧" },
  { id: "plan", name: "Plan", icon: "📋" },
  { id: "general", name: "General", icon: "💬" },
  { id: "explore", name: "Explore", icon: "🔍" },
];

const SUGGESTIONS = [
  "Explain this codebase to me",
  "Write a REST API in Node.js",
  "Find bugs in my code",
  "Create a README for my project",
  "Refactor this function for performance",
  "Add tests to my component",
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [supabase, setSupabase] = useState<any>(null);
  const { toast, Toaster } = useToast();

  useEffect(() => {
    import("@/lib/supabase-browser").then(({ createSupabaseBrowserClient }) => {
      setSupabase(createSupabaseBrowserClient());
    });
    setVoiceSupported(
      typeof window !== "undefined" &&
        ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    );
    // Check usage limit
    const usage = loadUsage();
    if (usage.messagesUsed >= usage.dailyLimit) setLimitReached(true);
  }, []);

  // Load messages
  useEffect(() => {
    if (isGuest || guest) {
      const sessions = loadGuestSessions();
      const session = sessions.find((s) => s.id === sessionId);
      if (session) {
        setMessages(session.messages || []);
        setActiveAgent(session.agent || "build");
      }
    } else if (supabase && user) {
      loadAccountSession();
    }
  }, [supabase, user, isGuest, guest, sessionId]);

  const loadAccountSession = async () => {
    if (!supabase || !user) return;
    const { data } = await supabase
      .from("sessions").select("*")
      .eq("id", sessionId).eq("user_id", user.id).single();
    if (data) {
      setMessages(data.state?.messages || []);
      setActiveAgent(data.agent_name || "build");
    }
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
      await supabase.from("sessions").update({
        state: { messages: updated },
        message_count: updated.length,
        agent_name: activeAgent,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachedImage) || sending) return;
    if (!canSend()) {
      setLimitReached(true);
      toast("Daily limit reached. Resets at midnight.", "error");
      return;
    }

    const userMsg: Message = {
      role: "user",
      content: input.trim(),
      image: attachedImage || undefined,
    };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
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
          prompt: userMsg.content,
          agent: activeAgent,
        }),
      });
      const data = await res.json();
      const reply: Message = data.error
        ? { role: "assistant", content: `⚠️ ${data.error}` }
        : { role: "assistant", content: data.content || "(empty)", metadata: data.metadata };

      const withReply = [...updated, reply];
      setMessages(withReply);
      await saveMessages(withReply);

      // Track usage
      const estTokens = Math.ceil((userMsg.content.length + reply.content.length) / 4);
      const usage = trackUsage(1, estTokens);
      if (usage.messagesUsed >= usage.dailyLimit) setLimitReached(true);
    } catch (err: any) {
      const withErr = [...updated, { role: "assistant" as const, content: `⚠️ ${err.message}` }];
      setMessages(withErr);
      await saveMessages(withErr);
    } finally {
      setSending(false);
    }
  };

  // Voice
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

  // Image
  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast("Image must be under 10MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const copyMsg = (c: string) => { navigator.clipboard.writeText(c); toast("Copied!", "success"); };

  const regenerate = async () => {
    if (sending || messages.length < 2) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    setMessages(messages.slice(0, -1));
    if (lastUser) { setInput(lastUser.content); setTimeout(() => sendMessage(), 50); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      <div className="orb orb-1" style={{ opacity: 0.08 }} />
      <Toaster />

      {/* Header */}
      <header className="glass-strong border-b border-white/5 px-3 sm:px-4 py-2.5 flex items-center justify-between shrink-0 relative z-20">
        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/dashboard")}
            className="glass-btn p-2 rounded-lg" title="Back">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-white">{messages.length > 0 ? messages[0].content.slice(0, 40) + "..." : "New Chat"}</div>
            <div className="text-[10px] text-gray-500">{messages.length} messages</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Agent picker */}
          <div className="relative">
            <button onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="glass-btn flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white">
              <span>{AGENTS.find((a) => a.id === activeAgent)?.icon}</span>
              <span className="hidden sm:inline">{AGENTS.find((a) => a.id === activeAgent)?.name}</span>
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAgentPicker && (
              <div className="absolute right-0 top-full mt-2 w-56 glass-strong rounded-2xl shadow-2xl z-50 py-2 animate-scale-in">
                <div className="px-4 py-1.5 text-[10px] uppercase tracking-wide text-gray-500">Free Agents</div>
                {AGENTS.map((a) => (
                  <button key={a.id}
                    onClick={() => { setActiveAgent(a.id); setShowAgentPicker(false); }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-3 transition-colors ${
                      activeAgent === a.id ? "text-indigo-400" : "text-white"
                    }`}>
                    <span className="text-lg">{a.icon}</span>
                    <div>
                      <div className="text-sm font-medium">{a.name}</div>
                      <div className="text-[10px] text-gray-500">{a.id}</div>
                    </div>
                    {activeAgent === a.id && <span className="ml-auto text-indigo-400">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={() => setShowUsage(!showUsage)}
            className="glass-btn p-2 rounded-lg" title="Usage">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
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
        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border-b border-red-500/20 px-4 py-2.5 text-sm text-red-400 flex items-center justify-center gap-2 animate-fade-in">
          ⚠️ Daily message limit reached. Resets at midnight.{" "}
          <Link href="/register" className="underline text-indigo-400">Upgrade</Link>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-up">
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center mb-5 animate-pulse-glow">
                <span className="text-4xl">🤖</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">What can I help with?</h2>
              <p className="text-gray-500 text-sm mb-8 max-w-md">
                Chat with your free opencode agent. Voice input, images, and persistent memory available.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 max-w-xl w-full">
                {SUGGESTIONS.map((s, i) => (
                  <button key={s} onClick={() => setInput(s)}
                    className={`glass-card p-4 text-left text-sm text-gray-400 hover:text-white animate-fade-up stagger-${i + 1}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className="mb-5 group animate-message-in">
              <div className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`shrink-0 h-8 w-8 rounded-xl flex items-center justify-center text-xs font-bold ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                    : "glass text-indigo-400"
                }`}>
                  {msg.role === "user" ? "You" : "🤖"}
                </div>

                <div className={`flex-1 min-w-0 ${msg.role === "user" ? "flex justify-end" : ""}`}>
                  <div className={`inline-block max-w-full rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                      : "glass-card !rounded-2xl text-gray-200"
                  }`}>
                    {msg.image && <img src={msg.image} alt="attached" className="max-w-xs rounded-xl mb-2" />}
                    <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">{msg.content}</div>
                  </div>

                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <button onClick={() => copyMsg(msg.content)}
                        className="glass-btn p-1.5 rounded-md text-gray-500 hover:text-white" title="Copy">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button onClick={regenerate} disabled={sending}
                        className="glass-btn p-1.5 rounded-md text-gray-500 hover:text-white disabled:opacity-30" title="Regenerate">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </button>
                      <button onClick={() => copyMsg(msg.content)}
                        className="glass-btn p-1.5 rounded-md text-gray-500 hover:text-white" title="Like">
                        👍
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex gap-3 mb-5 animate-message-in">
              <div className="shrink-0 h-8 w-8 rounded-xl glass flex items-center justify-center text-xs">🤖</div>
              <div className="glass-card !rounded-2xl px-5 py-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full typing-dot" />
                  <div className="w-2 h-2 bg-indigo-500 rounded-full typing-dot" />
                  <div className="w-2 h-2 bg-indigo-500 rounded-full typing-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-white/5 bg-gray-950/80 backdrop-blur-xl px-4 py-3 shrink-0 relative z-10">
        <div className="max-w-3xl mx-auto">
          {attachedImage && (
            <div className="mb-2 relative inline-block animate-scale-in">
              <img src={attachedImage} alt="preview" className="h-20 rounded-xl border border-white/10" />
              <button onClick={() => setAttachedImage(null)}
                className="absolute -top-2 -right-2 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs hover:bg-red-600 transition-colors">×</button>
            </div>
          )}

          <div className="glass-input flex items-end gap-2 rounded-2xl px-3 py-2 focus-within:border-indigo-500/50">
            <button onClick={() => fileInputRef.current?.click()}
              className="glass-btn p-2 rounded-lg text-gray-400 hover:text-white shrink-0" title="Upload image">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />

            <textarea ref={textareaRef} value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder={`Message ${AGENTS.find((a) => a.id === activeAgent)?.name}...`}
              rows={1} disabled={sending || limitReached}
              className="flex-1 bg-transparent resize-none text-sm text-white placeholder-gray-500 focus:outline-none max-h-[200px] py-1.5" />

            <button onClick={toggleVoice}
              className={`p-2 rounded-lg transition-all shrink-0 ${
                isRecording ? "bg-red-500/20 text-red-400 animate-pulse" : "glass-btn text-gray-400 hover:text-white"
              }`} title="Voice input">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <button onClick={sendMessage}
              disabled={sending || (!input.trim() && !attachedImage) || limitReached}
              className={`p-2 rounded-lg transition-all shrink-0 ${
                sending || (!input.trim() && !attachedImage) || limitReached
                  ? "bg-gray-800 text-gray-600"
                  : "glass-btn-primary text-white"
              }`} title="Send (Enter)">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between mt-2 px-1">
            <div className="text-[10px] text-gray-600">
              {isRecording ? <span className="text-red-400 animate-pulse">● Recording...</span> :
                <>Enter to send · Shift+Enter newline {voiceSupported && "· 🎤 voice"}</>}
            </div>
            <div className="text-[10px] text-gray-600">Powered by opencode</div>
          </div>
        </div>
      </div>
    </div>
  );
}