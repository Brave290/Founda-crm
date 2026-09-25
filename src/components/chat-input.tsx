"use client";

import {
  forwardRef, useEffect, useImperativeHandle, useRef, useState,
} from "react";
import { ImageIcon, MicIcon, SendIcon } from "@/components/icons";

export const COMMANDS = [
  { cmd: "/clear", desc: "Clear this conversation" },
  { cmd: "/help", desc: "List all commands" },
  { cmd: "/audit", desc: "Run a security audit (args: scope or pasted code)", arg: true },
  { cmd: "/model", desc: "Set model — /model pollinations/openai-fast", arg: true },
  { cmd: "/agent", desc: "Switch agent — /agent plan", arg: true },
  { cmd: "/image", desc: "Generate an image — /image a red fox", arg: true },
  { cmd: "/export", desc: "Export chat — /export json | md | png", arg: true },
];

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
}

/**
 * The composer lives in its own component so that every keystroke re-renders
 * only this dock — never the message list (remark/markdown parsing) above it.
 */
export const ChatInputDock = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInputDock(props, ref) {
    const {
      sending, limitReached, soundOn, editing, attachedImage, agentName,
      onSend, onStop, onCommand, onAttach, onRemoveImage, onCancelEdit, onToggleSound,
    } = props;

    const [text, setText] = useState("");
    const [cmdIdx, setCmdIdx] = useState(0);
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

    // reset command-menu highlight while typing
    useEffect(() => { setCmdIdx(0); }, [text]);

    useEffect(() => () => {
      try { recognitionRef.current?.stop(); } catch {}
    }, []);

    const showCmdList = text.startsWith("/") && !sending;
    const filteredCmds = showCmdList
      ? COMMANDS.filter((c) => c.cmd.startsWith(text.split(/\s/)[0]))
      : [];

    const send = () => {
      if (sending) { onStop(); return; }
      if (limitReached || (!text.trim() && !attachedImage)) return;
      onSend(text);
      setText("");
      const el = textareaRef.current;
      if (el) el.style.height = "auto";
    };

    const runSelectedCmd = () => {
      const sel = filteredCmds[cmdIdx];
      if (!sel) return;
      const first = text.split(/\s/)[0];
      if (first === sel.cmd) {
        const rest = text.slice(sel.cmd.length).trim();
        setText("");
        onCommand(sel.cmd, rest);
      } else {
        setText(sel.cmd + " ");
      }
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
      if (showCmdList && filteredCmds.length > 0) {
        if (e.key === "ArrowDown") { e.preventDefault(); setCmdIdx((i) => (i + 1) % filteredCmds.length); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); setCmdIdx((i) => (i - 1 + filteredCmds.length) % filteredCmds.length); return; }
        if (e.key === "Tab") { e.preventDefault(); setText(filteredCmds[cmdIdx].cmd + " "); return; }
        if (e.key === "Escape") { e.preventDefault(); setText(""); return; }
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runSelectedCmd(); return; }
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

    return (
      <>
        {showCmdList && filteredCmds.length > 0 && (
          <div className="absolute bottom-full mb-2 left-0 right-0 rounded-xl border border-white/10 bg-gradient-to-b from-[#1b2542] to-[#101728] backdrop-blur-2xl shadow-2xl shadow-black/70 py-1.5 overflow-hidden animate-scale-in z-30">
            <div className="px-4 py-1 text-[10px] uppercase tracking-wider text-slate-600">Commands</div>
            {filteredCmds.map((c, i) => (
              <button key={c.cmd}
                onMouseEnter={() => setCmdIdx(i)}
                onClick={runSelectedCmd}
                className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${i === cmdIdx ? "bg-white/[0.07] text-white" : "text-slate-400"}`}>
                <span className={`font-mono text-[12.5px] ${i === cmdIdx ? "text-white" : "text-slate-500"}`}>{c.cmd}</span>
                <span className="text-[12px] text-slate-600 truncate">{c.desc}</span>
              </button>
            ))}
          </div>
        )}

        {editing && (
          <div className="mb-2 flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-400/30 text-[11.5px] text-amber-200 animate-scale-in">
            <span>Editing message — your next send replaces the conversation from there</span>
            <button onClick={onCancelEdit} className="text-amber-300 hover:text-white shrink-0 transition-colors">Cancel</button>
          </div>
        )}

        {attachedImage && (
          <div className="mb-2 relative inline-block animate-scale-in">
            <img src={attachedImage} alt="preview" className="h-20 rounded-xl border border-white/10" />
            <button onClick={onRemoveImage}
              className="absolute -top-2 -right-2 h-5 w-5 bg-[#1a2130] border border-white/15 text-slate-300 rounded-full flex items-center justify-center text-xs hover:text-white transition-colors">×</button>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl px-3 py-2.5 bg-[#141b2a]/90 backdrop-blur-xl border border-white/[0.09] focus-within:border-white/25 shadow-[0_16px_50px_-12px_rgba(0,0,0,0.7)] transition-colors">
          <button onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg text-slate-500 hover:text-amber-300 transition-colors shrink-0" title="Upload image">
            <ImageIcon size={18} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach(f); e.target.value = ""; }}
            className="hidden" />

          <textarea ref={textareaRef} value={text}
            onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} onPaste={onPaste}
            placeholder={`Message ${agentName}…`}
            rows={1} disabled={limitReached}
            className="flex-1 bg-transparent resize-none text-sm text-white placeholder-slate-600 focus:outline-none max-h-[200px] py-1.5" />

          <button onClick={toggleVoice}
            className={`p-2 rounded-lg transition-all shrink-0 ${
              isRecording ? "bg-red-500/15 text-red-400 animate-pulse" : "text-slate-500 hover:text-sky-300"
            }`} title="Voice input">
            <MicIcon size={18} />
          </button>

          <button onClick={send}
            disabled={!sending && ((!text.trim() && !attachedImage) || limitReached)}
            className={`p-2.5 rounded-xl transition-colors shrink-0 ${
              sending
                ? "bg-red-500/15 text-red-400 hover:bg-red-500/25 active:scale-95"
                : (!text.trim() && !attachedImage) || limitReached
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
            {text.length > 0 && <span className="tabular-nums">{text.length.toLocaleString()} chars</span>}
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
