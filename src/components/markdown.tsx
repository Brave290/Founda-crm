"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopyIcon, CheckIcon } from "@/components/icons";

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? "").replace(/\n$/, "");
  const lang = (className || "").replace("language-", "");
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <div className="my-2.5 rounded-xl overflow-hidden border border-white/10 bg-slate-950/70">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.07] bg-white/[0.03]">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
          {lang || "code"}
        </span>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-300 transition-colors"
          title="Copy code"
        >
          {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-[12.5px] leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function Markdown({ content }: { content: string }) {
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
            if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>;
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
}
