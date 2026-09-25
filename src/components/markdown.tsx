"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyIcon, CheckIcon, DownloadIcon } from "@/components/icons";
import { ImageCard } from "@/components/image-card";

function ensureDoc(html: string): string {
  if (/<html[\s>]/i.test(html)) return html;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${html}</body></html>`;
}

function CodeBlock({ className, children, node, onImageClick }: { className?: string; children?: React.ReactNode; node?: any; onImageClick?: (src: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pubUrl, setPubUrl] = useState("");
  const [pubCopied, setPubCopied] = useState(false);
  const code = String(children ?? "").replace(/\n$/, "");

  let lang = (className || "").replace("language-", "").trim();
  let file = "";
  const colon = lang.indexOf(":");
  if (colon !== -1) {
    file = lang.slice(colon + 1);
    lang = lang.slice(0, colon);
  }
  const meta = typeof node?.data?.meta === "string" ? node.data.meta : "";
  if (!file) {
    const m = meta.match(/(?:file|filename|name)\s*[=:]\s*"?([\w./-]+)"?/i);
    if (m) file = m[1];
  }
  const filename = file || (/(html|htm)/.test(lang) ? "index.html" : `code.${lang || "txt"}`);
  const isHtml = /^(html|htm)$/.test(lang);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const download = () => {
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.includes(".") ? filename : `${filename}.${lang || "txt"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const publish = async () => {
    if (publishing || pubUrl) return;
    setPublishing(true);
    try {
      const r = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: filename, html: ensureDoc(code) }),
      });
      const d = await r.json();
      if (r.ok && d.url) setPubUrl(location.origin + d.url);
      else alert(d.error || "Publish failed");
    } catch {
      alert("Publish failed — check your connection");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="my-2.5 rounded-xl overflow-hidden border border-white/10 bg-slate-950/70">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-white/[0.07] bg-white/[0.03]">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium truncate">
          {filename}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          {isHtml && (
            <>
              <button
                onClick={() => setPreview((v) => !v)}
                className={`text-[11px] transition-colors ${preview ? "text-emerald-300" : "text-slate-500 hover:text-emerald-300"}`}
                title="Toggle live preview"
              >
                {preview ? "Code" : "Preview"}
              </button>
              <button
                onClick={publish}
                disabled={publishing}
                className="text-[11px] text-slate-500 hover:text-amber-300 transition-colors disabled:opacity-50"
                title="Publish to a permanent link"
              >
                {publishing ? "Publishing…" : pubUrl ? "Published ✓" : "Publish"}
              </button>
            </>
          )}
          <button
            onClick={download}
            className="text-[11px] text-slate-500 hover:text-sky-300 transition-colors"
            title={`Download ${filename}`}
          >
            <DownloadIcon size={13} />
          </button>
          <button
            onClick={copy}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-300 transition-colors"
            title="Copy code"
          >
            {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {pubUrl && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/[0.07] border-b border-emerald-500/20">
          <a href={pubUrl} target="_blank" rel="noreferrer" className="text-[11.5px] text-emerald-300 hover:text-emerald-200 underline decoration-emerald-500/40 truncate">
            {pubUrl}
          </a>
          <button
            onClick={() => { navigator.clipboard.writeText(pubUrl); setPubCopied(true); setTimeout(() => setPubCopied(false), 1500); }}
            className="text-[11px] text-slate-500 hover:text-white transition-colors shrink-0"
          >
            {pubCopied ? "Copied" : "Copy link"}
          </button>
        </div>
      )}

      {preview && isHtml ? (
        <iframe
          srcDoc={ensureDoc(code)}
          sandbox="allow-scripts allow-forms allow-popups allow-modals"
          className="w-full h-80 bg-white"
          title="Live preview"
        />
      ) : (
        <pre className="p-3.5 overflow-x-auto text-[12.5px] leading-relaxed text-slate-200">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

export const Markdown = memo(function Markdown({ content, onImageClick }: { content: string; onImageClick?: (src: string) => void }) {
  return (
    <div className="md-body text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className="font-display text-lg font-semibold text-white mt-4 mb-2 first:mt-0" {...p} />,
          h2: (p) => <h2 className="font-display text-base font-semibold text-white mt-4 mb-2 first:mt-0" {...p} />,
          h3: (p) => <h3 className="font-display text-[15px] font-semibold text-white mt-3 mb-1.5 first:mt-0" {...p} />,
          h4: (p) => <h4 className="font-semibold text-white mt-3 mb-1.5 first:mt-0" {...p} />,
          p: (p) => <p className="my-2 first:mt-0 last:mb-0" {...p} />,
          ul: (p) => <ul className="my-2 pl-5 list-disc space-y-1 marker:text-emerald-400" {...p} />,
          ol: (p) => <ol className="my-2 pl-5 list-decimal space-y-1 marker:text-emerald-400/80" {...p} />,
          li: (p) => <li className="marker:text-emerald-400" {...p} />,
          a: (p) => <a className="text-emerald-300 underline decoration-emerald-400/40 underline-offset-2 hover:decoration-emerald-300 break-all" target="_blank" rel="noreferrer" {...p} />,
          strong: (p) => <strong className="font-semibold text-white" {...p} />,
          em: (p) => <em className="italic text-slate-300" {...p} />,
          blockquote: (p) => (
            <blockquote className="my-2.5 pl-3.5 border-l-2 border-amber-400/50 text-slate-300 italic" {...p} />
          ),
          hr: () => <hr className="my-4 border-white/10" />,
          img: (p: any) => (
            <ImageCard
              src={p.src}
              alt={p.alt || ""}
              hoverOnly
              className="max-w-[480px] w-full my-2"
              {...(onImageClick ? { onOpen: () => onImageClick(p.src) } : {})}
            />
          ),
          table: (p) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-[13px] border-collapse" {...p} />
            </div>
          ),
          th: (p) => (
            <th className="px-3 py-2 text-left font-semibold text-white bg-white/[0.05] border-b border-white/10" {...p} />
          ),
          td: (p) => <td className="px-3 py-2 border-b border-white/[0.06] last:border-0" {...p} />,
          code: ({ className, children, ...rest }: any) => {
            const isBlock = /language-/.test(className || "") || String(children).includes("\n");
            if (isBlock) return <CodeBlock className={className} node={rest.node} onImageClick={onImageClick}>{children}</CodeBlock>;
            return (
              <code
                className="px-1.5 py-0.5 mx-0.5 rounded-md bg-white/[0.07] border border-white/[0.08] text-[12.5px] text-amber-200"
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }: any) => <>{children}</>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
