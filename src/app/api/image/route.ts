import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Free image generation proxy (Pollinations) with retry — the public endpoint
// rate-limits intermittently (429), so we back off and retry server-side.
// Seeded URLs are deterministic → aggressively cacheable.

const clamp = (v: number, lo: number, hi: number, dflt: number) =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : dflt;

export async function GET(req: NextRequest) {
  const prompt = req.nextUrl.searchParams.get("prompt")?.trim();
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
  if (prompt.length > 800)
    return NextResponse.json({ error: "prompt too long (max 800 chars)" }, { status: 400 });

  const w = clamp(parseInt(req.nextUrl.searchParams.get("width") || ""), 64, 2048, 1024);
  const h = clamp(parseInt(req.nextUrl.searchParams.get("height") || ""), 64, 2048, 1024);
  const seed = clamp(parseInt(req.nextUrl.searchParams.get("seed") || ""), 0, 2_147_483_647, Math.floor(Math.random() * 1_000_000));

  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${w}&height=${h}&nologo=true&seed=${seed}`;

  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(50_000) });
      lastStatus = res.status;
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const ct = res.headers.get("content-type") || "image/jpeg";
        if (buf.length > 2_000 && ct.startsWith("image")) {
          return new NextResponse(new Uint8Array(buf), {
            headers: {
              "Content-Type": ct,
              "Cache-Control": "public, max-age=86400, s-maxage=86400, immutable",
              "X-Seed": String(seed),
            },
          });
        }
      }
    } catch {
      lastStatus = 0;
    }
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
  }

  return NextResponse.json(
    { error: `image generation failed (upstream ${lastStatus || "timeout"}) — try again in a moment` },
    { status: 502 }
  );
}
