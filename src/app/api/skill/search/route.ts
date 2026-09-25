import { NextRequest, NextResponse } from "next/server";
import { fetchWithRetry } from "@/lib/net";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** POST {q, count?} → live web search (DuckDuckGo lite, no key). */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const q = String(body.q || "").trim().slice(0, 300);
  const count = Math.min(Math.max(Number(body.count) || 6, 1), 10);
  if (!q) return NextResultsError("q required");

  // 1) DDG HTML endpoint (scrape) — best signal.
  try {
    const res = await fetchWithRetry(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" } },
      { timeoutMs: 10_000, retries: 1 }
    );
    const html = await res.text();
    const results: { title: string; url: string; snippet: string }[] = [];
    const re =
      /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>|<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>)/g;
    const strip = (h: string) =>
      h.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&nbsp;/g, " ").trim();
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && results.length < count) {
      let url = m[1];
      const uddg = /uddg=([^&"]+)/.exec(url);
      if (uddg) url = decodeURIComponent(uddg[1]);
      if (!url.startsWith("http")) continue;
      results.push({
        title: strip(m[2]),
        url,
        snippet: strip(m[3] || m[4] || ""),
      });
    }
    if (results.length) return NextResponse.json({ query: q, results, source: "duckduckgo" });
  } catch {
    /* fall through */
  }

  // 2) Fallback: DDG Instant Answer API (weaker but reliable).
  try {
    const res = await fetchWithRetry(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
      {},
      { timeoutMs: 8_000, retries: 1 }
    );
    const d: any = await res.json();
    const results: { title: string; url: string; snippet: string }[] = [];
    if (d.AbstractText) results.push({ title: d.Heading || q, url: d.AbstractURL || "", snippet: d.AbstractText });
    const topics: any[] = d.RelatedTopics || [];
    for (const t of topics) {
      if (results.length >= count) break;
      const r = t.FirstURL ? t : t.Topics?.[0];
      if (r?.FirstURL && r?.Text) results.push({ title: r.Text.slice(0, 90), url: r.FirstURL, snippet: r.Text });
    }
    return NextResponse.json({ query: q, results, source: "instant" });
  } catch {
    return NextResultsError("search failed — try rephrasing the query");
  }
}

function NextResultsError(error: string) {
  return NextResponse.json({ error, results: [] }, { status: 400 });
}
