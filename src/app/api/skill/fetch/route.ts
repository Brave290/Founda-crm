import { NextRequest, NextResponse } from "next/server";
import { fetchWithRetry } from "@/lib/net";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PRIVATE_HOST =
  /^(localhost|127\.|0\.0\.0\.0|::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|metadata\.google\.internal)/i;

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (PRIVATE_HOST.test(u.hostname)) return null;
    return u;
  } catch {
    return null;
  }
}

const stripHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** POST {url, max?} → readable text of any web page (reader-first, strip fallback). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const target = safeUrl(String(body.url || "").trim());
  if (!target)
    return NextResponse.json({ error: "url required (http/https only)" }, { status: 400 });
  const max = Math.min(Math.max(Number(body.max) || 8000, 500), 20_000);

  // 1) Reader endpoint — best markdown for articles/docs/video pages.
  if (!body.direct)
  try {
    const res = await fetchWithRetry(
      `https://r.jina.ai/${target.toString()}`,
      { headers: { Accept: "text/plain", "X-Return-Format": "markdown" } },
      { timeoutMs: 15_000, retries: 1 }
    );
    if (res.ok) {
      const text = (await res.text()).trim();
      if (text.length > 80) {
        const truncated = text.length > max;
        return NextResponse.json({
          url: target.toString(),
          text: truncated ? text.slice(0, max) + "\n\n[truncated]" : text,
          truncated,
          source: "reader",
        });
      }
    }
  } catch {
    /* fall through */
  }

  // 2) Direct fetch + HTML strip.
  try {
    const res = await fetchWithRetry(
      target.toString(),
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,text/plain,*/*",
        },
      },
      { timeoutMs: 12_000, retries: 1 }
    );
    if (!res.ok) return NextResponse.json({ error: `HTTP ${res.status}` }, { status: 502 });
    const raw = await res.text();
    const ct = res.headers.get("content-type") || "";
    const text = ct.includes("json") ? JSON.stringify(JSON.parse(raw), null, 2).slice(0, max) : stripHtml(raw);
    const truncated = text.length > max;
    return NextResponse.json({
      url: target.toString(),
      title: (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1] || "").trim().slice(0, 200),
      text: truncated ? text.slice(0, max) + "\n\n[truncated]" : text,
      truncated,
      source: "direct",
    });
  } catch (e: any) {
    return NextResponse.json({ error: `fetch failed: ${e?.message || "network error"}` }, { status: 502 });
  }
}
