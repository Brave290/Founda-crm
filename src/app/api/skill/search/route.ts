import { NextRequest, NextResponse } from "next/server";
import { fetchWithRetry } from "@/lib/net";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Result = { title: string; url: string; snippet: string };

const decode = (h: string) =>
  h
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const resolveHref = (href: string) => {
  let u = href.replace(/&amp;/g, "&");
  const uddg = /uddg=([^&]+)/.exec(u);
  if (uddg) u = decodeURIComponent(uddg[1]);
  return u;
};

/** Loose parser: catches class-before-href, href-before-class, single or double quotes. */
function parseDdgResults(html: string, limit: number): Result[] {
  const out: Result[] = [];
  const anchorRe = /<a\s[^>]*>/g;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) && out.length < limit) {
    const tag = m[0];
    if (!/class\s*=\s*["'][^"']*result__(?:a|snippet)|class\s*=\s*["']result-link/.test(tag)) continue;
    const isTitle = /result__a|result-link/.test(tag);
    if (!isTitle) continue;
    const hrefM = /href\s*=\s*["']([^"']+)["']/.exec(tag);
    if (!hrefM) continue;
    const end = html.indexOf("</a>", m.index);
    if (end === -1) continue;
    const title = decode(html.slice(m.index + tag.length, end));
    if (!title) continue;
    let snippet = "";
    const tail = html.slice(end, end + 3000);
    const snM = /result[-_]+snippet[^>]*>([\s\S]*?)(?:<\/a>|<\/td>)/.exec(tail);
    if (snM) snippet = decode(snM[1]);
    const url = resolveHref(hrefM[1]);
    if (!/^https?:\/\//.test(url)) continue;
    out.push({ title: title.slice(0, 160), url, snippet: snippet.slice(0, 400) });
  }
  return out;
}

/** POST {q, count?} → live web search: DuckDuckGo (html → lite → instant) → Wikipedia. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const q = String(body.q || "").trim().slice(0, 300);
  const count = Math.min(Math.max(Number(body.count) || 6, 1), 10);
  if (!q)
    return NextResponse.json({ error: "q required", results: [] }, { status: 400 });

  const ua = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  };

  // 1) Bing RSS — direct URLs, clean XML, the only engine that reliably
  //    answers from Vercel's egress (DDG returns 403 for datacenter IPs).
  try {
    const res = await fetchWithRetry(
      `https://www.bing.com/search?q=${encodeURIComponent(q)}&format=rss&mkt=en-US&count=${count}`,
      { headers: ua },
      { timeoutMs: 10_000, retries: 1 }
    );
    if (res.ok) {
      const xml = await res.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      const results: Result[] = [];
      for (const item of items.slice(0, count)) {
        const t = /<title>([\s\S]*?)<\/title>/.exec(item);
        const l = /<link>([\s\S]*?)<\/link>/.exec(item);
        const d = /<description>([\s\S]*?)<\/description>/.exec(item);
        const url = (l?.[1] || "").trim();
        if (!/^https?:\/\//.test(url)) continue;
        results.push({
          title: decode(t?.[1] || url).slice(0, 160),
          url,
          snippet: decode(d?.[1] || "").slice(0, 400),
        });
      }
      if (results.length) return NextResponse.json({ query: q, results, source: "bing" });
    }
  } catch {
    /* next */
  }

  // 2) DuckDuckGo HTML
  try {
    const res = await fetchWithRetry(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
      { headers: ua },
      { timeoutMs: 10_000, retries: 1 }
    );
    if (res.ok) {
      const results = parseDdgResults(await res.text(), count);
      if (results.length) return NextResponse.json({ query: q, results, source: "duckduckgo" });
    }
  } catch {
    /* next */
  }

  // 3) DuckDuckGo Lite
  try {
    const res = await fetchWithRetry(
      `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`,
      { headers: ua },
      { timeoutMs: 10_000, retries: 1 }
    );
    if (res.ok) {
      const results = parseDdgResults(await res.text(), count);
      if (results.length) return NextResponse.json({ query: q, results, source: "duckduckgo-lite" });
    }
  } catch {
    /* next */
  }

  // 4) DDG Instant Answer (text-only summaries)
  try {
    const res = await fetchWithRetry(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { Accept: "application/json" } },
      { timeoutMs: 8_000, retries: 1 }
    );
    const text = await res.text();
    const d = JSON.parse(text);
    const results: Result[] = [];
    if (d.AbstractText)
      results.push({ title: d.Heading || q, url: d.AbstractURL || "", snippet: d.AbstractText });
    const topics: any[] = d.RelatedTopics || [];
    for (const t of topics) {
      if (results.length >= count) break;
      const r = t.FirstURL ? t : t.Topics?.[0];
      if (r?.FirstURL && r?.Text)
        results.push({ title: decode(r.Text).slice(0, 120), url: r.FirstURL, snippet: decode(r.Text) });
    }
    if (results.length) return NextResponse.json({ query: q, results, source: "instant" });
  } catch {
    /* next */
  }

  // 5) Wikipedia search — always reachable, real pages + snippets.
  try {
    const res = await fetchWithRetry(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${count}&format=json&origin=*`,
      { headers: { Accept: "application/json" } },
      { timeoutMs: 8_000, retries: 1 }
    );
    const d: any = await res.json();
    const results: Result[] = (d?.query?.search || []).map((s: any) => ({
      title: String(s.title),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(s.title).replace(/ /g, "_"))}`,
      snippet: decode(String(s.snippet || "")),
    }));
    if (results.length) return NextResponse.json({ query: q, results, source: "wikipedia" });
  } catch {
    /* give up */
  }

  return NextResponse.json(
    { error: "search failed — try rephrasing the query", results: [] },
    { status: 502 }
  );
}
