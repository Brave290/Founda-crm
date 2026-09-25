"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth, loadGuestSessions, saveGuestSession } from "@/lib/auth";
import { trackUsage, canSend, loadUsage, UsagePanel, useToast } from "@/components/UsagePanel";
import {
  WrenchIcon, ClipboardIcon, MessageIcon, SearchIcon, BotIcon,
  ImageIcon, MicIcon, SendIcon, CopyIcon, RefreshIcon, ThumbsUpIcon,
  AlertIcon, ChevronDownIcon, CheckIcon, MenuIcon,
  ShieldIcon, DownloadIcon, TrashIcon, LayersIcon, BarChartIcon,
} from "@/components/icons";
import { Markdown } from "@/components/markdown";
import { CommandPalette, type PaletteAction } from "@/components/palette";
import { Sidebar } from "@/components/sidebar";
import { SettingsModal } from "@/components/settings-modal";
import { AgentActivity, type AgentActivityData } from "@/components/agent-activity";
import { buildAuditPrompt } from "@/lib/skills";

interface Message {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  image?: string;
  metadata?: any;
  ts?: number;
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
  { cmd: "/image", desc: "Generate an image — /image a red fox", arg: true },
  { cmd: "/export", desc: "Export chat — /export json | md | png", arg: true },
];

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<string | undefined>();
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
  const [ocSessionId, setOcSessionId] = useState<string | null>(null);
  const [activity, setActivity] = useState<AgentActivityData | null>(null);
  const [streamText, setStreamText] = useState("");
  const [streamReason, setStreamReason] = useState("");
  const [reasonOpen, setReasonOpen] = useState(false);
  const [thoughtMs, setThoughtMs] = useState(0);
  const [expandedReason, setExpandedReason] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [online, setOnline] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [editFrom, setEditFrom] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stopRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cmdIdx, setCmdIdx] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [modelList, setModelList] = useState<any[]>([]);
  const [showModelPicker, setShowModelPicker] = useState(false);

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
  const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");

  useEffect(() => setCmdIdx(0), [input]);

  // Cmd/Ctrl+K command palette
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        router.push(`/sessions/${crypto.randomUUID()}`);
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setShowModelPicker(false);
        setLightbox(null);
        setExpandedReason(null);
        setEditFrom(null);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [router]);

  // Offline banner + completion-sound preference
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    import("@/lib/store").then((st) => st.ready().then(() => setSoundOn(Boolean(st.getPrefs().notifySound)))).catch(() => {});
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((d) => setModelList(Array.isArray(d.models) ? d.models : []))
      .catch(() => {});
    import("@/lib/store")
      .then(async (store) => {
        await store.ready();
        const m = store.getPrefs().model;
        if (typeof m === "string" && m) setModel(m);
      })
      .catch(() => {});
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
  }, [messages, streamText]);

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

  const exportPNG = async () => {
    const W = 920;
    const PAD = 48;
    const LH = 26;
    const TITLE_H = 96;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) { toast("Canvas not supported", "error"); return; }

    const font = (px: number, w = 400) => `${w} ${px}px "Plus Jakarta Sans", ui-sans-serif, sans-serif`;
    const wrap = (text: string, maxW: number, f: string): string[] => {
      ctx.font = f;
      const out: string[] = [];
      for (const raw of text.split("\n")) {
        if (!raw) { out.push(""); continue; }
        const words = raw.split(" ");
        let line = "";
        for (const w of words) {
          const t = line ? line + " " + w : w;
          if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; }
          else line = t;
        }
        out.push(line);
      }
      return out;
    };

    const roleF = font(15, 700);
    const textF = font(15, 400);
    const metaF = font(12, 500);

    type Row = { h: number; draw: (y: number) => void };
    const rows: Row[] = [];

    for (const m of messages) {
      const name = m.role === "user" ? "You" : activeAgentMeta?.name || "Assistant";
      const lines = wrap(m.content, W - PAD * 2 - 120, textF);
      const tagW = ctx.measureText(name).width;
      const bodyH = Math.max(lines.length * LH, LH);
      const blockH = 18 + 14 + bodyH + 30;
      rows.push({
        h: blockH,
        draw: (y) => {
          ctx.font = roleF;
          ctx.fillStyle = m.role === "user" ? "#34d399" : "#fbbf24";
          ctx.fillText(name, PAD, y + 24);
          ctx.font = metaF;
          ctx.fillStyle = "#475569";
          ctx.fillText(m.role === "user" ? "" : "", PAD + tagW + 10, y + 24);
          ctx.font = textF;
          ctx.fillStyle = m.role === "user" ? "#e2e8f0" : "#cbd5e1";
          lines.forEach((ln, i) => ctx.fillText(ln, PAD, y + 52 + i * LH));
          ctx.strokeStyle = "rgba(255,255,255,0.06)";
          ctx.beginPath();
          ctx.moveTo(PAD, y + blockH - 8);
          ctx.lineTo(W - PAD, y + blockH - 8);
          ctx.stroke();
        },
      });
    }

    const bodyH = rows.reduce((a, r) => a + r.h, 0);
    const FOOT_H = 72;
    canvas.width = W * 2;
    canvas.height = (TITLE_H + bodyH + FOOT_H) * 2;
    ctx.scale(2, 2);

    // background
    ctx.fillStyle = "#0b1120";
    ctx.fillRect(0, 0, W, TITLE_H + bodyH + FOOT_H);

    // header
    const grad = ctx.createLinearGradient(PAD, 24, PAD + 260, 70);
    grad.addColorStop(0, "#34d399");
    grad.addColorStop(1, "#f59e0b");
    ctx.font = font(26, 800);
    ctx.fillStyle = grad;
    ctx.fillText("Founda · " + (activeAgentMeta?.name || "Chat"), PAD, 56);
    ctx.font = metaF;
    ctx.fillStyle = "#64748b";
    ctx.fillText(`${messages.length} messages · ${new Date().toLocaleString()}`, PAD, 80);

    let y = TITLE_H;
    for (const r of rows) { r.draw(y); y += r.h; }

    // footer
    ctx.font = metaF;
    ctx.fillStyle = "#475569";
    ctx.fillText("Generated by Founda CRM · powered by opencode", PAD, y + 40);

    canvas.toBlob((blob) => {
      if (!blob) { toast("Export failed", "error"); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `founda-chat-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Exported PNG", "success");
    }, "image/png");
  };

  const runSlash = async (cmd: string, arg: string) => {
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    if (cmd === "/clear") {
      setMessages([]);
      setOcSessionId(null);
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
      import("@/lib/store").then((st) => st.savePrefs({ model: arg })).catch(() => {});
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
      if (arg === "png" || arg === "image") exportPNG();
      else exportChat(arg === "md" || arg === "markdown" ? "md" : "json");
      return;
    }
    if (cmd === "/image") {
      if (!arg) { toast("Usage: /image a red fox in the snow", "error"); return; }
      const seed = Math.floor(Math.random() * 1_000_000);
      const src = `/api/image?prompt=${encodeURIComponent(arg)}&width=1024&height=1024&seed=${seed}`;
      const userMsg: Message = { role: "user", content: `/image ${arg}` };
      const imgMsg: Message = { role: "assistant", content: arg, image: src };
      const withMsgs = [...messages, userMsg, imgMsg];
      setMessages(withMsgs);
      await saveMessages(withMsgs);
      trackUsage(1, 800);
      toast("Generating image…", "success");
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
      ts: Date.now(),
    };
    const bodyImage = overridePrompt ? null : attachedImage || null;
    const base = editFrom != null ? messages.slice(0, editFrom) : messages;
    const updated = [...base, userMsg];
    setEditFrom(null);
    stopRef.current = false;
    setMessages(updated);
    if (!overridePrompt) setInput("");
    if (updated.length === 1) renameSession(String(opts?.label || body).slice(0, 60));
    setAttachedImage(null);
    setSending(true);
    setActivity(null);
    setStreamReason("");
    setReasonOpen(false);
    setThoughtMs(0);
    const thinkStart = Date.now();
    let reasonText = "";
    let reasonAutoOpened = false;
    let answerCollapsed = false;
    const collapseReason = () => {
      if (reasonText && !answerCollapsed) {
        answerCollapsed = true;
        setReasonOpen(false);
        setThoughtMs(Date.now() - thinkStart);
      }
    };
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    saveMessages(updated).catch(() => {});
    let lastContent = "";

    try {
      const ctl = new AbortController();
      abortRef.current = ctl;
      setTimeout(() => ctl.abort(), 55_000);
      const payload: any = {
        sessionId: ocSessionId || sessionId,
        prompt: overridePrompt || userMsg.content,
        history: base.slice(-12).map((m) => ({ role: m.role, content: String(m.content || "").slice(0, 1500) })),
        agent: activeAgent,
        stream: true,
        ...(model ? { model } : {}),
        ...(opts?.systemPrompt ? { systemPrompt: opts.systemPrompt } : {}),
        ...(bodyImage ? { image: bodyImage } : {}),
      };

      // one silent retry for flaky networks before surfacing an error
      let res: Response | null = null;
      for (let netTry = 0; netTry < 2 && !res; netTry++) {
        try {
          res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: ctl.signal,
          });
        } catch (e) {
          if (ctl.signal.aborted || netTry === 1) throw e;
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      if (!res) throw new Error("Network error");

      const contentType = res.headers.get("content-type") || "";
      let content = "";
      let metadata: any;
      let streamErr: string | null = null;
      let done = false;

      if (res.ok && contentType.includes("text/event-stream") && res.body) {
        try {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        const handleEvent = (name: string, data: any) => {
          if (name === "activity") {
            if (Array.isArray(data.steps)) setActivity(data as AgentActivityData);
          } else if (name === "reason") {
            reasonText = typeof data.text === "string" ? data.text : "";
            setStreamReason(reasonText);
            if (reasonText && !reasonAutoOpened) {
              reasonAutoOpened = true;
              setReasonOpen(true);
            }
          } else if (name === "delta") {
            content = typeof data.text === "string" ? data.text : content;
            lastContent = content;
            setStreamText(content);
            if (content && reasonText) collapseReason();
          } else if (name === "done") {
            done = true;
            if (typeof data.content === "string" && data.content) content = data.content;
            lastContent = content;
            if (data.sessionId) setOcSessionId(data.sessionId);
            metadata = data.metadata;
            collapseReason();
            if (reasonText) {
              metadata = { ...(metadata || {}), reasoning: reasonText, thoughtMs: Date.now() - thinkStart };
            }
          } else if (name === "error") {
            streamErr = data.error || "stream error";
          }
        };
        while (true) {
          const { done: readDone, value } = await reader.read();
          if (readDone) break;
          buf += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buf.indexOf("\n\n")) !== -1) {
            const chunk = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            let evName = "";
            let dataStr = "";
            for (const line of chunk.split("\n")) {
              if (line.startsWith("event: ")) evName = line.slice(7);
              else if (line.startsWith("data: ")) dataStr += line.slice(6);
            }
            if (evName && dataStr) {
              try { handleEvent(evName, JSON.parse(dataStr)); } catch {}
            }
          }
        }
        } catch {
          /* stream broke mid-way — handled below */
        }
      } else {
        // Non-stream fallback: plain JSON (error or legacy path)
        const data = await res.json().catch(() => ({} as any));
        if (data.error) streamErr = data.error;
        else {
          content = data.content || "";
          if (data.sessionId) setOcSessionId(data.sessionId);
          metadata = data.metadata;
        }
      }

      // Network died mid-stream → one silent non-stream retry before giving up
      if (!done && !streamErr && !content && !stopRef.current) {
        try {
          const r2 = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, stream: false }),
            signal: ctl.signal,
          });
          const d2 = await r2.json().catch(() => ({} as any));
          if (d2.content) {
            content = d2.content;
            lastContent = content;
            metadata = d2.metadata;
            if (d2.sessionId) setOcSessionId(d2.sessionId);
            done = true;
            setStreamText("");
          }
        } catch {}
        if (!done) streamErr = "Connection lost — tap Retry";
      }
      if (ctl.signal.aborted && !stopRef.current && !streamErr) streamErr = "Request timed out (55s) — tap Retry";
      if (stopRef.current && !content) content = "(stopped)";

      const reply: Message = streamErr
        ? { role: "assistant", content: `Error: ${streamErr}`, ts: Date.now() }
        : { role: "assistant", content: content || "(empty response)", metadata, ts: Date.now() };
      if (!streamErr) beep();

      const withReply = [...updated, reply];
      setMessages(withReply);
      saveMessages(withReply).catch(() => {});

      const estTokens = Math.ceil((userMsg.content.length + reply.content.length) / 4);
      const usage = trackUsage(1, estTokens);
      if (usage.messagesUsed >= usage.dailyLimit) setLimitReached(true);
    } catch (err: any) {
      const aborted = err?.name === "AbortError" || abortRef.current?.signal?.aborted;
      const msg = stopRef.current
        ? lastContent || "(stopped)"
        : aborted
          ? "Error: Request timed out (55s) — tap Retry"
          : `Error: ${err.message}`;
      const withErr = [...updated, { role: "assistant" as const, content: msg, ts: Date.now() }];
      setMessages(withErr);
      saveMessages(withErr).catch(() => {});
    } finally {
      abortRef.current = null;
      stopRef.current = false;
      setSending(false);
      setStreamText("");
      setStreamReason("");
      setActivity(null);
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

  const readFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) { toast("Image must be under 10MB", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => setAttachedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith("image/")) {
      readFile(file);
      toast("Image attached", "success");
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const it of Array.from(items)) {
      if (it.type.startsWith("image/")) {
        const file = it.getAsFile();
        if (file) { e.preventDefault(); readFile(file); }
      }
    }
  };

  const onScrollMessages = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
  };
  const scrollToEnd = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const beep = (force = false) => {
    if (!soundOn && !force) return;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = 740;
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      o.start();
      o.stop(ctx.currentTime + 0.3);
      setTimeout(() => ctx.close(), 700);
    } catch {}
  };

  const toggleSound = async () => {
    const next = !soundOn;
    setSoundOn(next);
    try {
      const st = await import("@/lib/store");
      await st.ready();
      st.savePrefs({ notifySound: next });
    } catch {}
    if (next) beep(true);
  };

  const stopGeneration = () => {
    stopRef.current = true;
    abortRef.current?.abort();
  };

  const renameSession = async (title: string) => {
    if (!title) return;
    try {
      if (isGuest || guest) {
        const sessions = loadGuestSessions();
        const idx = sessions.findIndex((x: any) => x.id === sessionId);
        if (idx >= 0) {
          sessions[idx].title = title;
          saveGuestSession(sessions[idx]);
        }
      } else if (supabase && user) {
        await supabase.from("sessions").update({ title }).eq("id", sessionId);
      }
    } catch {}
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
  const availableModels = modelList.filter((m) => m.available);
  const activeModelMeta = availableModels.find((m) => m.id === model);

  const pickModel = (id: string) => {
    setModel(id);
    setShowModelPicker(false);
    import("@/lib/store").then((st) => st.savePrefs({ model: id })).catch(() => {});
    toast(id ? `Model: ${id}` : "Model: auto (default)", "success");
  };

  const paletteActions: PaletteAction[] = [
    { id: "new", group: "Chat", label: "New chat", hint: "start fresh", icon: <MessageIcon size={14} />, run: () => router.push(`/sessions/${crypto.randomUUID()}${isGuest || guest ? "?guest=1" : ""}`) },
    { id: "audit", group: "Chat", label: "Run security audit", hint: "/audit", icon: <ShieldIcon size={14} />, run: () => runSlash("/audit", "") },
    { id: "image", group: "Chat", label: "Generate an image…", hint: "/image", icon: <ImageIcon size={14} />, run: () => { setInput("/image "); setTimeout(() => textareaRef.current?.focus(), 50); } },
    { id: "export-json", group: "Chat", label: "Export chat as JSON", hint: "/export json", icon: <DownloadIcon size={14} />, run: () => exportChat("json") },
    { id: "export-md", group: "Chat", label: "Export chat as Markdown", hint: "/export md", icon: <DownloadIcon size={14} />, run: () => exportChat("md") },
    { id: "export-png", group: "Chat", label: "Export chat as PNG image", hint: "/export png", icon: <ImageIcon size={14} />, run: () => exportPNG() },
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
    { id: "skills", group: "Navigation", label: "Browse plugin skills", hint: "image · video · search · more", icon: <LayersIcon size={14} />, run: () => { setSettingsTab("skills"); setSettingsOpen(true); } },
  ];

  return (
    <div className="h-screen flex bg-[#0b0f17]">
      <Toaster />
      <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} currentId={sessionId} onOpenSettings={() => { setSettingsTab(undefined); setSettingsOpen(true); }} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} initialTab={settingsTab} />

      <div className="flex-1 min-w-0 flex flex-col relative overflow-hidden bg-[#0b0f17]">
      {/* Header */}
      <header className="h-12 px-2 sm:px-4 flex items-center justify-between shrink-0 relative z-20 border-b border-white/[0.06]">
        <div className="flex items-center gap-1 min-w-0">
          <button onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06]" title="Menu">
            <MenuIcon size={16} />
          </button>
          <div className="min-w-0">
            <div className="text-[13px] text-slate-300 truncate max-w-[42vw] sm:max-w-[340px]">
              {messages.length > 0 && messages[0].content ? messages[0].content.slice(0, 50) + "…" : "New chat"}
            </div>
            <div className="text-[10px] text-slate-700">{messages.length} messages</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => router.push("/dashboard")}
            className="hidden lg:block text-[12.5px] text-slate-500 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
            Dashboard
          </button>
          {/* Agent picker */}
          <div className="relative">
            <button onClick={() => setShowAgentPicker(!showAgentPicker)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] text-slate-300 hover:text-white border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
              <span className={`h-2 w-2 rounded-full ${activeAgentMeta?.dot || "bg-emerald-400"}`} />
              {activeAgentMeta?.icon}
              <span className="hidden sm:inline">{activeAgentMeta?.name}</span>
              <ChevronDownIcon size={12} className="text-slate-500" />
            </button>
            {showAgentPicker && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/10 bg-[#141a26] shadow-2xl shadow-black/60 z-50 py-1.5 animate-scale-in overflow-hidden">
                <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-slate-600">Free agents</div>
                {AGENTS.map((a) => (
                  <button key={a.id}
                    onClick={() => { setActiveAgent(a.id); setShowAgentPicker(false); }}
                    className={`w-full text-left px-4 py-2 hover:bg-white/[0.06] flex items-center gap-3 transition-colors ${
                      activeAgent === a.id ? "text-white bg-white/[0.08]" : "text-slate-400"
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

          {/* Model picker */}
          <div className="relative">
            <button onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] text-slate-300 hover:text-white border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
              title="Model">
              <svg className="w-4 h-4 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5m-4.25-11.396c.251.023.501.05.75.082M5 14.5l-1.455 2.91A2.25 2.25 0 005.318 21H18.68a2.25 2.25 0 001.773-3.59L19 14.5" />
              </svg>
              <span className="hidden sm:inline max-w-[140px] truncate text-[12.5px]">
                {activeModelMeta?.label || (model ? model.split("/").slice(-1)[0] : "Auto model")}
              </span>
              <ChevronDownIcon size={12} className="text-slate-500" />
            </button>
            {showModelPicker && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-white/10 bg-[#141a26] shadow-2xl shadow-black/60 z-50 py-1.5 animate-scale-in overflow-hidden max-h-[60vh] overflow-y-auto">
                <button onClick={() => pickModel("")}
                  className={`w-full text-left px-4 py-2 hover:bg-white/[0.06] flex items-center justify-between transition-colors ${!model ? "text-white bg-white/[0.08]" : "text-slate-400"}`}>
                  <span className="text-[13px]">Auto (default)</span>
                  {!model && <CheckIcon size={13} className="text-emerald-400" />}
                </button>
                {["keyless", "env", "store"].map((src) => {
                  const group = availableModels.filter((m) => m.source === src);
                  if (!group.length) return null;
                  return (
                    <div key={src}>
                      <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wider text-slate-600">
                        {src === "keyless" ? "Free · no key" : src === "env" ? "Server key" : "Your API keys"}
                      </div>
                      {group.map((m) => (
                        <button key={m.id} onClick={() => pickModel(m.id)}
                          className={`w-full text-left px-4 py-2 hover:bg-white/[0.06] flex items-center justify-between transition-colors ${model === m.id ? "text-white bg-white/[0.08]" : "text-slate-400"}`}>
                          <div className="min-w-0">
                            <div className="text-[13px] truncate">{m.label}</div>
                            <div className="text-[10px] text-slate-600 font-mono truncate">{m.id}</div>
                          </div>
                          {model === m.id && <CheckIcon size={13} className="text-emerald-400 shrink-0 ml-2" />}
                        </button>
                      ))}
                    </div>
                  );
                })}
                {availableModels.length === 0 && (
                  <div className="px-4 py-3 text-[12px] text-slate-600">Loading models…</div>
                )}
              </div>
            )}
          </div>

          <button onClick={() => setShowUsage(!showUsage)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors" title="Usage">
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
      <div ref={scrollRef} onScroll={onScrollMessages}
        onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
        className="flex-1 overflow-y-auto relative z-10">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-up">
              <div className="h-12 w-12 rounded-full border border-white/[0.1] bg-white/[0.04] flex items-center justify-center mb-5 text-slate-400">
                <BotIcon size={22} />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">How can I help?</h2>
              <p className="text-slate-500 text-sm mb-8 max-w-md">
                Chat with your free opencode agent. Voice input, images, and persistent memory available.
              </p>
              <div className="grid sm:grid-cols-2 gap-2.5 max-w-xl w-full">
                {SUGGESTIONS.map((s, i) => (
                  <button key={s} onClick={() => sendMessage({ prompt: s })}
                    className={`rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] p-3.5 text-left text-[13px] text-slate-400 hover:text-white transition-colors animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className="mb-6 group animate-message-in">
              <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] ${
                  msg.role === "user"
                    ? "rounded-3xl bg-[#1a2130] px-4 py-2.5 text-[14px] text-slate-100 leading-[1.5]"
                    : "w-full"
                }`}>
                  {msg.image && (
                    <img src={msg.image} alt={msg.content || "generated image"} loading="lazy"
                      onClick={() => setLightbox(msg.image!)}
                      className="max-w-xs w-full rounded-lg mb-2 border border-white/10 animate-fade-in cursor-zoom-in hover:opacity-90 transition-opacity" />
                  )}
                  {msg.role === "assistant" && !!msg.metadata?.reasoning && (
                    <>
                      <button onClick={() => setExpandedReason(expandedReason === i ? null : i)}
                        className="flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-slate-300 mb-1.5 transition-colors">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                          className={`transition-transform ${expandedReason === i ? "rotate-90" : ""}`}>
                          <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Thought for {(((msg.metadata.thoughtMs || 0) / 1000) || 1).toFixed(1)}s
                      </button>
                      {expandedReason === i && (
                        <div className="mb-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 max-h-56 overflow-y-auto">
                          <div className="text-[12.5px] text-slate-500 whitespace-pre-wrap leading-[1.5]">{msg.metadata.reasoning}</div>
                        </div>
                      )}
                    </>
                  )}
                  {msg.role === "assistant" ? (
                    <Markdown content={msg.content} onImageClick={setLightbox} />
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">{msg.content}</div>
                  )}

                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity min-h-[14px]">
                    {msg.ts ? <span>{new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> : null}
                    {msg.role === "assistant" && msg.metadata?.model && (
                      <span className="truncate max-w-[170px]" title={msg.metadata.model}>· {msg.metadata.model}</span>
                    )}
                    {msg.role === "user" && i === lastUserIdx && !sending && !msg.image && (
                      <button onClick={() => { setEditFrom(i); setInput(String(msg.content)); setTimeout(() => textareaRef.current?.focus(), 30); }}
                        className="ml-auto hover:text-white transition-colors">
                        Edit &amp; resend
                      </button>
                    )}
                  </div>

                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 mt-2 -ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={() => copyMsg(msg.content, i)}
                        className="p-1.5 rounded-md text-slate-600 hover:text-white hover:bg-white/[0.06] transition-colors" title="Copy">
                        {copiedIdx === i ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                      </button>
                      {msg.content.startsWith("Error:") && (
                        <button onClick={regenerate} disabled={sending}
                          className="px-2 py-1 rounded-md text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors disabled:opacity-30">
                          Retry
                        </button>
                      )}
                      <button onClick={regenerate} disabled={sending}
                        className="p-1.5 rounded-md text-slate-600 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-30" title="Regenerate">
                        <RefreshIcon size={13} />
                      </button>
                      <button onClick={() => copyMsg(msg.content, i)}
                        className="p-1.5 rounded-md text-slate-600 hover:text-white hover:bg-white/[0.06] transition-colors" title="Good response">
                        <ThumbsUpIcon size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {sending && streamReason && (
            <div className="mb-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden animate-message-in">
              <button onClick={() => setReasonOpen((o) => !o)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-white/[0.03] transition-colors">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                  className={`text-slate-500 transition-transform ${reasonOpen ? "rotate-90" : ""}`}>
                  <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {reasonOpen ? (
                  <span className="flex items-center gap-2">
                    <span className="flex gap-1 items-center">
                      <span className="w-1.5 h-1.5 bg-slate-500 rounded-full typing-dot" />
                      <span className="w-1.5 h-1.5 bg-slate-500 rounded-full typing-dot" />
                      <span className="w-1.5 h-1.5 bg-slate-500 rounded-full typing-dot" />
                    </span>
                    <span className="text-[12.5px] text-slate-400">Thinking…</span>
                  </span>
                ) : (
                  <span className="text-[12.5px] text-slate-500">Thought for {((thoughtMs || 1000) / 1000).toFixed(1)}s</span>
                )}
              </button>
              {reasonOpen && (
                <div className="px-4 pb-3 max-h-52 overflow-y-auto">
                  <div className="text-[12.5px] text-slate-500 whitespace-pre-wrap leading-[1.5]">{streamReason}</div>
                </div>
              )}
            </div>
          )}

          {sending && activity && activity.steps.length > 0 && (
            <div className="mb-4 space-y-2">
              {activity.steps.slice(-3).map((s) => {
                const isCmd = /bash|shell|execute|command/i.test(s.tool);
                return (
                  <div key={s.id} className="rounded-xl border border-white/[0.07] bg-black/45 overflow-hidden animate-message-in">
                    <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.05]">
                      {s.status === "running" ? (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                      ) : s.status === "error" ? (
                        <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                      <span className="text-[11px] text-slate-400 truncate">{s.title}</span>
                    </div>
                    <pre className="px-3 py-2 text-[11.5px] font-mono text-slate-300 whitespace-pre-wrap break-all max-h-36 overflow-y-auto leading-[1.5]">{isCmd && s.detail ? `$ ${s.detail}\n` : s.detail ? `${s.detail}\n` : ""}{s.output || (s.status === "running" ? "…" : "")}</pre>
                  </div>
                );
              })}
            </div>
          )}

          {sending && streamText && (
            <div className="mb-6 animate-message-in">
              <div className="flex justify-start">
                <div className="w-full max-w-[88%]">
                  <Markdown content={streamText} />
                </div>
              </div>
            </div>
          )}

          {sending && !streamText && !streamReason && (
            <div className="mb-6 flex items-center gap-2.5 animate-message-in">
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full typing-dot" />
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full typing-dot" />
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full typing-dot" />
              </span>
              <span className="text-[13px] text-slate-600">Thinking…</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {!online && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[130] px-4 py-1.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[12px] backdrop-blur-xl shadow-lg">
          You're offline — messages may fail
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setLightbox(null)} role="dialog" aria-label="Image preview">
          <img src={lightbox} alt="preview" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button onClick={() => setLightbox(null)}
            className="absolute top-4 right-5 text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>
      )}

      {paletteOpen && <CommandPalette actions={paletteActions} onClose={() => setPaletteOpen(false)} />}

      {/* Input */}
      <div className="px-4 pt-2 pb-5 shrink-0 relative z-10">
        <div className="max-w-3xl mx-auto relative">
          {!atBottom && messages.length > 0 && (
            <button onClick={scrollToEnd}
              className="absolute -top-10 right-1 h-8 px-3 rounded-full bg-[#1a2130]/95 border border-white/10 shadow-xl text-[11.5px] text-slate-300 hover:text-white backdrop-blur flex items-center gap-1.5 z-20 transition-colors">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Latest
            </button>
          )}
          {sending && activity && <AgentActivity activity={activity} />}
          {showCmdList && filteredCmds.length > 0 && (
            <div className="absolute bottom-full mb-2 left-0 right-0 rounded-xl border border-white/[0.09] bg-[#141a26] shadow-2xl shadow-black/60 py-1.5 overflow-hidden animate-scale-in z-30">
              <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-slate-600">Commands</div>
              {filteredCmds.map((c, i) => (
                <button key={c.cmd}
                  onMouseEnter={() => setCmdIdx(i)}
                  onClick={() => {
                    if (input.split(/\s/)[0] === c.cmd) runSlash(c.cmd, input.slice(c.cmd.length).trim());
                    else setInput(c.cmd + " ");
                  }}
                  className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${i === cmdIdx ? "bg-white/[0.07] text-white" : "text-slate-400"}`}>
                  <span className={`font-mono text-[12.5px] ${i === cmdIdx ? "text-white" : "text-slate-500"}`}>{c.cmd}</span>
                  <span className="text-[12px] text-slate-600 truncate">{c.desc}</span>
                </button>
              ))}
            </div>
          )}
          {editFrom != null && (
            <div className="mb-2 flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-400/30 text-[11.5px] text-amber-200 animate-scale-in">
              <span>Editing message — your next send replaces the conversation from there</span>
              <button onClick={() => setEditFrom(null)} className="text-amber-300 hover:text-white shrink-0 transition-colors">Cancel</button>
            </div>
          )}
          {attachedImage && (
            <div className="mb-2 relative inline-block animate-scale-in">
              <img src={attachedImage} alt="preview" className="h-20 rounded-xl border border-white/10" />
              <button onClick={() => setAttachedImage(null)}
                className="absolute -top-2 -right-2 h-5 w-5 bg-[#1a2130] border border-white/15 text-slate-300 rounded-full flex items-center justify-center text-xs hover:text-white transition-colors">×</button>
            </div>
          )}

          <div className="flex items-end gap-2 rounded-2xl px-3 py-2.5 bg-[#141b2a]/90 backdrop-blur-xl border border-white/[0.09] focus-within:border-white/25 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.7)] transition-colors">
            <button onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg text-slate-500 hover:text-amber-300 transition-colors shrink-0" title="Upload image">
              <ImageIcon size={18} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />

            <textarea ref={textareaRef} value={input}
              onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} onPaste={handlePaste}
              placeholder={`Message ${activeAgentMeta?.name}…`}
              rows={1} disabled={limitReached}
              className="flex-1 bg-transparent resize-none text-sm text-white placeholder-slate-600 focus:outline-none max-h-[200px] py-1.5" />

            <button onClick={toggleVoice}
              className={`p-2 rounded-lg transition-all shrink-0 ${
                isRecording ? "bg-red-500/15 text-red-400 animate-pulse" : "text-slate-500 hover:text-sky-300"
              }`} title="Voice input">
              <MicIcon size={18} />
            </button>

            <button onClick={() => (sending ? stopGeneration() : sendMessage())}
              disabled={!sending && ((!input.trim() && !attachedImage) || limitReached)}
              className={`p-2.5 rounded-xl transition-colors shrink-0 ${
                sending
                  ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 active:scale-95"
                  : (!input.trim() && !attachedImage) || limitReached
                    ? "bg-white/[0.06] text-slate-700"
                    : "bg-emerald-600 text-white hover:bg-emerald-500 active:scale-95"
              }`} title={sending ? "Stop generating" : "Send (Enter)"}>
              {sending ? (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor"><rect x="3" y="3" width="9" height="9" rx="1.5"/></svg>
              ) : (
                <SendIcon size={17} />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-3 text-[10px] text-slate-700">
              {isRecording ? <span className="text-red-400 animate-pulse">Recording…</span> :
                <>Enter send · / commands · ⌘K palette{voiceSupported && " · voice"}</>}
              {input.length > 0 && <span className="tabular-nums">{input.length.toLocaleString()} chars</span>}
              <button onClick={toggleSound}
                className={`transition-colors ${soundOn ? "text-emerald-500" : "hover:text-white"}`}
                title="Toggle completion sound">
                Sound {soundOn ? "on" : "off"}
              </button>
            </div>
            <div className="text-[10px] text-slate-700">Founda</div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
