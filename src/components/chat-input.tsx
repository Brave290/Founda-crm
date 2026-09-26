"use client";

import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode,
} from "react";
import {
  ArrowLeftIcon, BotIcon, DownloadIcon, ImageIcon, MessageIcon, MicIcon,
  PlugIcon, ZapIcon,
} from "@/components/icons";

export const COMMANDS = [
  { cmd: "/clear", desc: "Clear this conversation" },
  { cmd: "/help", desc: "List all commands" },
  { cmd: "/audit", desc: "Run a security audit (args: scope or pasted code)", arg: true },
  { cmd: "/model", desc: "Set model — /model pollinations/openai-fast", arg: true },
  { cmd: "/agent", desc: "Switch agent — /agent plan", arg: true },
  { cmd: "/image", desc: "Generate an image — /image a red fox", arg: true },
  { cmd: "/export", desc: "Export chat — /export json | md | png", arg: true },
];

interface MItem {
  label: string;
  hint?: string;
  mono?: boolean;
  icon?: ReactNode;
  run?: () => void;
  items?: MItem[];
}

export interface ChatInputHandle {
  set(text: string): void;
  focus(): void;
}

export interface ChatInputProps {
  sending: boolean;
  limitReached: boolean;
  soundOn: boolean;
  editing: boolean;
  attachedImage: string | null;
  agentName: string;
  onSend: (text: string) => void;
  onStop: () => void;
  onCommand: (cmd: string, arg: string) => void;
  onAttach: (file: File) => void;
  onRemoveImage: () => void;
  onCancelEdit: () => void;
  onToggleSound: () => void;
  onOpenMcp?: () => void;
}

/**
 * The composer lives in its own component so that every keystroke re-renders
 * only this dock — never the message list (remark/markdown parsing) above it.
 *
 * Manus-style bar: textarea on top, toolbar row inside the same rounded box
 * (slash / attach / MCP left, mic + circular send right), and a two-level
 * slash popup — level 1 lists command groups, choosing one opens level 2.
 */
export const ChatInputDock = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInputDock(props, ref) {
    const {
      sending, limitReached, soundOn, editing, attachedImage, agentName,
      onSend, onStop, onCommand, onAttach, onRemoveImage, onCancelEdit,
      onToggleSound, onOpenMcp,
    } = props;

    const [text, setText] = useState("");
    const [groupIdx, setGroupIdx] = useState(0);
    const [itemIdx, setItemIdx] = useState(0);
    const [openGroup, setOpenGroup] = useState<string | null>(null);
    const [modelItems, setModelItems] = useState<MItem[] | null>(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [voiceSupported, setVoiceSupported] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    useImperativeHandle(
      ref,
      () => ({
        set: (t: string) => { setText(t); },
        focus: () => { textareaRef.current?.focus(); },
      }),
      []
    );

    useEffect(() => {
      setVoiceSupported(
        typeof window !== "undefined" &&
          ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
      );
    }, []);

    // auto-grow
    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }, [text]);

    // reset menu highlight while typing
    useEffect(() => { setGroupIdx(0); setItemIdx(0); }, [text]);

    useEffect(() => () => {
      try { recognitionRef.current?.stop(); } catch {}
    }, []);

    // ── Two-level slash menu ─────────────────────────────────────────────
    const firstToken = text.startsWith("/") ? (text.split(/\s/)[0] || "/") : "";
    const showMenu = !!firstToken && !sending;
    const q = firstToken.slice(1).toLowerCase();

    const send = () => {
      if (sending) { onStop(); return; }
      if (limitReached || (!text.trim() && !attachedImage)) return;
      // a fully typed command executes instead of going to the model
      if (text.startsWith("/")) {
        const exact = COMMANDS.find((c) => c.cmd === firstToken);
        if (exact) {
          const rest = text.slice(firstToken.length).trim();
          setText("");
          onCommand(exact.cmd, rest);
          return;
        }
      }
      onSend(text);
      setText("");
      const el = textareaRef.current;
      if (el) el.style.height = "auto";
    };

    // ── Two-level slash menu: groups + optional auto-drill ───────────────
    const groups: MItem[] = [
      {
        label: "Chat", icon: <MessageIcon size={14} />, items: [
          { label: "/clear", hint: "Clear this conversation", mono: true, run: () => onCommand("/clear", "") },
          { label: "/help", hint: "List all commands", mono: true, run: () => onCommand("/help", "") },
          { label: "/audit", hint: "Run a security audit", mono: true, run: () => onCommand("/audit", "") },
        ],
      },
      {
        label: "Agent", icon: <BotIcon size={14} />, items: [
          { label: "Build", hint: "Write code, ship features", run: () => onCommand("/agent", "build") },
          { label: "Plan", hint: "Design before coding", run: () => onCommand("/agent", "plan") },
          { label: "General", hint: "Everyday assistant", run: () => onCommand("/agent", "general") },
          { label: "Explore", hint: "Search & explain code", run: () => onCommand("/agent", "explore") },
        ],
      },
      {
        label: "Image", icon: <ImageIcon size={14} />, items: [
          { label: "Square", hint: "1024 × 1024", run: () => setText("/image 1024x1024 ") },
          { label: "Wide", hint: "1280 × 720", run: () => setText("/image 1280x720 ") },
          { label: "Portrait", hint: "768 × 1152", run: () => setText("/image 768x1152 ") },
          { label: "Icon", hint: "512 × 512", run: () => setText("/image 512x512 ") },
        ],
      },
      {
        label: "Export", icon: <DownloadIcon size={14} />, items: [
          { label: "JSON", hint: "Raw messages", run: () => onCommand("/export", "json") },
          { label: "Markdown", hint: "Readable transcript", run: () => onCommand("/export", "md") },
          { label: "PNG image", hint: "Shareable picture", run: () => onCommand("/export", "png") },
        ],
      },
      {
        label: "Model", icon: <ZapIcon size={14} />, items:
          modelItems || [{ label: "Loading models…", hint: "fetching catalog", run: () => {} }],
      },
    ];

    // level-2 view: an explicitly opened group, or an auto-drill when the typed
    // token matches a leaf command but no group name (e.g. "/clear").
    const opened = openGroup ? groups.find((g) => g.label === openGroup) : null;
    const childHits = q
      ? groups.filter((g) => g.label.toLowerCase() !== q &&
          (g.items || []).some((c) =>
            c.label.toLowerCase().replace(/^\//, "").startsWith(q) ||
            (c.hint || "").toLowerCase().startsWith(q)))
      : [];
    const autoGroup = !opened && q && childHits.length ? childHits[0] : null;
    const level2 = opened || autoGroup;
    const level1Items = q
      ? groups.filter((g) => g.label.toLowerCase().startsWith(q))
      : groups;
    // both empty → degrade to the full group list rather than an empty popup
    const viewItems: MItem[] = level2
      ? (level2.items || [])
      : (level1Items.length ? level1Items : groups);
    const curIdx = level2 ? itemIdx : groupIdx;
    const setCurIdx = level2 ? setItemIdx : setGroupIdx;

    // keep the open group consistent with what's typed: "/model" stays level 2,
    // backspacing to "/mod" returns to level 1.
    const typedToken = text.startsWith("/") ? firstToken.toLowerCase() : "";
    useEffect(() => {
      if (openGroup && typedToken !== "/" + openGroup.toLowerCase()) setOpenGroup(null);
      if (openGroup === "Model" && !modelLoaded) {
        setModelLoaded(true);
        fetch("/api/models").then((r) => r.json()).then((d: any) => {
          const list: MItem[] = (d?.models || []).slice(0, 30).map((m: any) => ({
            label: m.label || m.id,
            hint: m.id,
            run: () => onCommand("/model", m.id),
          }));
          setModelItems(list.length ? list : [{ label: "No models found", hint: "check API keys", run: () => {} }]);
        }).catch(() => setModelItems([{ label: "Failed to load models", hint: "try again", run: () => {} }]));
      }
    }, [typedToken, openGroup, modelLoaded, onCommand]);

    const openGroupMenu = (g: MItem) => {
      setOpenGroup(g.label);
      setItemIdx(0);
      setText("/" + g.label.toLowerCase() + " ");
      textareaRef.current?.focus();
    };

    const runItem = (it: MItem) => {
      if (it.items) { openGroupMenu(it); return; }
      setText("");
      it.run?.();
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
      if (showMenu && viewItems.length > 0) {
        if (e.key === "ArrowDown") { e.preventDefault(); setCurIdx((i) => (i + 1) % viewItems.length); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); setCurIdx((i) => (i - 1 + viewItems.length) % viewItems.length); return; }
        if (e.key === "Tab") { e.preventDefault(); runItem(viewItems[curIdx]); return; }
        if (e.key === "Escape") {
          e.preventDefault();
          if (openGroup) { setOpenGroup(null); setText("/"); }
          else setText("");
          return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          // fully typed command ("/image a red fox") → dispatch directly with args
          const exact = COMMANDS.find((c) => c.cmd === firstToken);
          if (exact) {
            const rest = text.slice(firstToken.length).trim();
            setText("");
            onCommand(exact.cmd, rest);
            return;
          }
          const filtered = level2 || level1Items.length > 0 || childHits.length > 0;
          if (filtered) runItem(viewItems[curIdx]);
          else send(); // no menu match ("/xyz") → send as a normal message
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    };

    const onPaste = (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) { e.preventDefault(); onAttach(file); }
        }
      }
    };

    const toggleVoice = () => {
      if (!voiceSupported) return;
      if (isRecording) { recognitionRef.current?.stop(); setIsRecording(false); return; }
      try {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const rec = new SR();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = "en-US";
        rec.onresult = (e: any) => {
          let t = "";
          for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
          setText(t);
        };
        rec.onend = () => setIsRecording(false);
        rec.onerror = () => setIsRecording(false);
        rec.start();
        recognitionRef.current = rec;
        setIsRecording(true);
      } catch {}
    };

    const slashClick = () => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? text.length;
      if (!text) setText("/");
      else if (!text.startsWith("/")) setText(text.slice(0, start) + "/" + text.slice(start));
      el.focus();
    };

    const roundBtn = "h-8 w-8 rounded-full border border-white/[0.08] bg-white/[0.04] flex items-center justify-center transition-all shrink-0";

    return (
      <>
        {showMenu && viewItems.length > 0 && (
          <div className="absolute bottom-full mb-2.5 left-0 right-0 rounded-2xl border border-white/10 bg-gradient-to-b from-[#1b2542] to-[#101728] backdrop-blur-2xl shadow-2xl shadow-black/70 py-1.5 overflow-y-auto max-h-80 animate-scale-in z-30">
            <div className="px-3.5 pt-0.5 pb-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                {level2 ? level2.label : "Commands"}
              </span>
              {openGroup && (
                <button
                  onMouseDown={(e) => { e.preventDefault(); setOpenGroup(null); setText("/"); }}
                  className="flex items-center gap-1 text-[10.5px] text-slate-500 hover:text-white transition-colors">
                  <ArrowLeftIcon size={11} /> Back
                </button>
              )}
            </div>
            {viewItems.map((it, i) => {
              const active = i === curIdx;
              const isLeaf = !it.items;
              return (
                <button
                  key={it.label}
                  onMouseEnter={() => setCurIdx(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => runItem(it)}
                  className={`w-full text-left px-3.5 py-2 flex items-center gap-3 transition-colors ${active ? "bg-white/[0.07]" : ""}`}>
                  <span className={`shrink-0 flex items-center justify-center h-7 w-7 rounded-lg border transition-colors ${
                    active ? "border-white/20 bg-white/[0.06] text-white" : "border-white/[0.07] bg-white/[0.03] text-slate-500"}`}>
                    {it.icon || (it.mono
                      ? <span className="font-mono text-[10.5px]">/</span>
                      : <span className="text-[11px] font-semibold">{it.label.slice(0, 1)}</span>)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] leading-tight ${it.mono ? "font-mono text-[12.5px]" : "font-medium"} ${
                      active ? "text-white" : "text-slate-300"}`}>{it.label}</span>
                    {it.hint && (
                      <span className={`block text-[11.5px] truncate ${active ? "text-slate-400" : "text-slate-600"}`}>
                        {it.hint}
                      </span>
                    )}
                  </span>
                  {!isLeaf && (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                      className={`shrink-0 ${active ? "text-slate-400" : "text-slate-700"}`}>
                      <path d="M4.5 2.5L8 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {editing && (
          <div className="mb-2 flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-400/30 text-[11.5px] text-amber-200 animate-scale-in">
            <span>Editing message — your next send replaces the conversation from there</span>
            <button onClick={onCancelEdit} className="text-amber-300 hover:text-white shrink-0 transition-colors">Cancel</button>
          </div>
        )}

        {/* Manus-style composer box: text on top, toolbar row inside */}
        <div className="rounded-[24px] px-3.5 pt-3 pb-2.5 bg-[#141b2a]/90 backdrop-blur-xl border border-white/[0.09] focus-within:border-white/25 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.7)] transition-colors">
          {attachedImage && (
            <div className="mb-2 relative inline-block animate-scale-in">
              <img src={attachedImage} alt="preview" className="h-20 rounded-xl border border-white/10" />
              <button onClick={onRemoveImage}
                className="absolute -top-2 -right-2 h-5 w-5 bg-[#1a2130] border border-white/15 text-slate-300 rounded-full flex items-center justify-center text-xs hover:text-white transition-colors">×</button>
            </div>
          )}

          <textarea ref={textareaRef} value={text}
            onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} onPaste={onPaste}
            placeholder={`Send message to ${agentName}`}
            rows={1} disabled={limitReached}
            className="w-full bg-transparent resize-none text-[15px] text-white placeholder-slate-600 focus:outline-none max-h-[200px] py-1 px-0.5" />

          <div className="flex items-center justify-between gap-2 mt-1.5">
            <div className="flex items-center gap-1.5">
              <button onClick={slashClick}
                className={`${roundBtn} font-mono text-[13px] leading-none text-slate-500 hover:text-white hover:border-white/25`}
                title="Commands menu (/)">/</button>
              <button onClick={() => fileInputRef.current?.click()}
                className={`${roundBtn} text-slate-500 hover:text-amber-300 hover:border-white/25`}
                title="Attach image">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach(f); e.target.value = ""; }}
                className="hidden" />
              <button onClick={onOpenMcp}
                className={`${roundBtn} text-slate-500 hover:text-emerald-300 hover:border-white/25`}
                title="MCP servers & integrations">
                <PlugIcon size={14} />
              </button>
              {text.length > 0 && (
                <span className="ml-1 text-[10px] text-slate-700 tabular-nums">{text.length.toLocaleString()}</span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button onClick={toggleVoice}
                className={`${roundBtn} ${
                  isRecording ? "!border-red-400/40 bg-red-500/15 text-red-400 animate-pulse" : "text-slate-500 hover:text-sky-300 hover:border-white/25"
                }`} title="Voice input">
                <MicIcon size={14} />
              </button>

              <button onClick={send}
                disabled={!sending && ((!text.trim() && !attachedImage) || limitReached)}
                className={`h-9 w-9 rounded-full flex items-center justify-center transition-all shrink-0 active:scale-95 ${
                  sending
                    ? "bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/25"
                    : (!text.trim() && !attachedImage) || limitReached
                      ? "bg-white/[0.06] text-slate-700"
                      : "bg-emerald-500 text-[#06281a] hover:bg-emerald-400 shadow-lg shadow-emerald-500/25"
                }`} title={sending ? "Stop generating" : "Send (Enter)"}>
                {sending ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="2" width="8" height="8" rx="1.5" /></svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M7.5 12V3M7.5 3L3.5 7M7.5 3l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2 px-1">
          <div className="flex items-center gap-3 text-[10px] text-slate-700">
            {isRecording ? <span className="text-red-400 animate-pulse">Recording…</span> :
              <>Enter send · / commands · ⌘K palette{voiceSupported && " · voice"}</>}
            <button onClick={onToggleSound}
              className={`transition-colors ${soundOn ? "text-emerald-500" : "hover:text-white"}`}
              title="Toggle completion sound">
              Sound {soundOn ? "on" : "off"}
            </button>
          </div>
          <div className="text-[10px] text-slate-700">Founda</div>
        </div>
      </>
    );
  }
);
