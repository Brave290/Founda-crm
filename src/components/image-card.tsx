"use client";

import { useState } from "react";
import { DownloadIcon, CopyIcon, CheckIcon, RefreshIcon, AlertIcon } from "@/components/icons";

/** Save an image to disk (same-origin, data: and remote URLs all supported). */
export async function downloadImage(src: string, filename = "founda-image") {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const mime = blob.type || "image/jpeg";
    const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : mime.includes("gif") ? "gif" : "jpg";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch {
    window.open(src, "_blank", "noopener");
    return false;
  }
}

async function copyImage(src: string): Promise<"image" | "link" | "fail"> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ [blob.type || "image/png"]: blob })]);
        return "image";
      } catch {}
    }
    await navigator.clipboard.writeText(src);
    return "link";
  } catch {
    try {
      await navigator.clipboard.writeText(src);
      return "link";
    } catch {
      return "fail";
    }
  }
}

function ToolBtn({
  onClick, title, children, primary,
}: { onClick: () => void; title: string; children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-[11.5px] font-medium transition-all active:scale-95 ${
        primary
          ? "bg-emerald-600/90 border-emerald-400/40 text-white hover:bg-emerald-500"
          : "bg-black/65 border-white/15 text-slate-200 hover:bg-black/85 hover:text-white"
      } backdrop-blur-md shadow-lg shadow-black/40`}
    >
      {children}
    </button>
  );
}

/**
 * ChatGPT-style image card: shimmering "Creating image…" skeleton → fade-in,
 * prompt header, hover action bar (Download / Copy / Edit / Regenerate).
 */
export function ImageCard({
  src,
  alt = "",
  prompt,
  hoverOnly,
  className = "",
  onOpen,
  onEdit,
  onRegenerate,
}: {
  src: string;
  alt?: string;
  prompt?: string;
  hoverOnly?: boolean;
  className?: string;
  onOpen?: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState<"dl" | "cp" | null>(null);
  const [copied, setCopied] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const name = (prompt || alt || "image").replace(/[^\w\-]+/g, "-").slice(0, 40) || "image";

  const doDownload = async () => {
    setBusy("dl");
    await downloadImage(src, name);
    setBusy(null);
  };

  const doCopy = async () => {
    setBusy("cp");
    const r = await copyImage(src);
    setBusy(null);
    if (r !== "fail") {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <figure
      className={`group/img relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f1524] shadow-xl shadow-black/40 ${className}`}
      onClick={(e) => { if (!loaded) return; e.stopPropagation(); onOpen?.(); }}
    >
      {/* tool-card header — ChatGPT image generation style */}
      {(prompt || !loaded) && (
        <figcaption className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.07] bg-white/[0.035]">
          <span className="shrink-0 h-5 w-5 rounded-md bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-500 flex items-center justify-center shadow-sm">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3z" />
              <path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
            </svg>
          </span>
          <span className="text-[12px] text-slate-300 font-medium shrink-0">Image generation</span>
          {prompt && <span className="text-[11.5px] text-slate-500 truncate hidden sm:block">{prompt}</span>}
          <span className={`ml-auto shrink-0 text-[10.5px] px-2 py-0.5 rounded-full border transition-opacity ${
            loaded
              ? "opacity-0"
              : "opacity-100 border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
          }`}>
            Creating image<span className="typing-dot inline-block ml-0.5">.</span><span className="typing-dot inline-block">.</span><span className="typing-dot inline-block">.</span>
          </span>
        </figcaption>
      )}

      <div className={`relative ${!loaded && !err ? "min-h-[190px]" : ""}`}>
        {/* shimmer skeleton */}
        {!loaded && !err && <div className="absolute inset-0 animate-shimmer" aria-hidden />}

        {err ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
            <AlertIcon size={18} className="text-red-400" />
            <div className="text-[12.5px] text-slate-400">Image failed to load</div>
            <button
              onClick={(e) => { e.stopPropagation(); setErr(false); setLoaded(false); setRetryKey((k) => k + 1); }}
              className="text-[12px] text-emerald-300 hover:text-emerald-200 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : (
          <img
            key={retryKey}
            src={src}
            alt={alt}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setErr(true)}
            className={`block w-full max-w-full transition-opacity duration-500 cursor-zoom-in ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* action bar — always visible on message cards, hover-only in markdown */}
        {loaded && (onOpen || onEdit || onRegenerate) && (
          <div className={`absolute bottom-2 right-2 flex items-center gap-1.5 transition-opacity duration-200 ${
            hoverOnly ? "opacity-0 group-hover/img:opacity-100" : "opacity-100"
          }`}>
            <ToolBtn onClick={doDownload} title="Download image" primary>
              {busy === "dl" ? (
                <span className="h-3.5 w-3.5 border-[1.5px] border-white/50 border-t-white rounded-full animate-spin" />
              ) : (
                <DownloadIcon size={13} />
              )}
              <span className="hidden sm:inline">Download</span>
            </ToolBtn>
            <ToolBtn onClick={doCopy} title="Copy image">
              {copied ? <CheckIcon size={13} className="text-emerald-300" /> : busy === "cp" ? (
                <span className="h-3.5 w-3.5 border-[1.5px] border-slate-400 border-t-white rounded-full animate-spin" />
              ) : (
                <CopyIcon size={13} />
              )}
            </ToolBtn>
            {onEdit && (
              <ToolBtn onClick={onEdit} title="Edit this image in the composer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </ToolBtn>
            )}
            {onRegenerate && (
              <ToolBtn onClick={onRegenerate} title="Generate a new variation">
                <RefreshIcon size={13} />
              </ToolBtn>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}
