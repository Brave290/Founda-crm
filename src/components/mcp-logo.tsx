"use client";

import { useState } from "react";

/**
 * Brand logo for MCP entries, Manus-style: try the Simple Icons CDN for the
 * preset slug, then the first slug segment (handles ids like "resend-remote"),
 * then the site favicon, and finally a gradient letter avatar. Never broken.
 */
export function McpLogo({
  name, url, id, size = 32, radius = 9,
}: { name: string; url?: string; id?: string; size?: number; radius?: number }) {
  const [stage, setStage] = useState(0);

  const slug = (id || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const shortSlug = slug.split("-")[0];
  let host = "";
  try { host = url ? new URL(url).hostname : ""; } catch {}

  const candidates: string[] = [
    `https://cdn.simpleicons.org/${slug}/white`,
    ...(shortSlug !== slug ? [`https://cdn.simpleicons.org/${shortSlug}/white`] : []),
    ...(host ? [`https://www.google.com/s2/favicons?domain=${host}&sz=64`] : []),
  ];
  const src = candidates[stage];

  const letter = (name || "?").trim().slice(0, 1).toUpperCase();
  const grads = [
    "from-emerald-500/80 to-teal-700/80",
    "from-sky-500/80 to-blue-700/80",
    "from-violet-500/80 to-indigo-700/80",
    "from-amber-500/80 to-orange-700/80",
    "from-rose-500/80 to-pink-700/80",
  ];
  const grad = grads[(name || "x").charCodeAt(0) % grads.length];

  if (!src) {
    return (
      <div style={{ width: size, height: size, borderRadius: radius }}
        className={`bg-gradient-to-br ${grad} text-white flex items-center justify-center font-semibold shrink-0`}>
        <span style={{ fontSize: size * 0.42 }}>{letter}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setStage((s) => s + 1)}
      style={{ width: size, height: size, borderRadius: radius }}
      className="object-contain shrink-0 bg-white/[0.06] p-[3px] border border-white/[0.07]"
    />
  );
}
