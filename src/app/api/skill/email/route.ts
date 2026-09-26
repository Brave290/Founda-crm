import { NextRequest, NextResponse } from "next/server";
import { resolveStoreTarget, readStoreData } from "@/lib/store-server";
import { resolveSmtp, sendMail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// In-memory rate limit: 5 sends per identity per 10 minutes.
const hits: { who: string; at: number }[] = [];
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;

/**
 * POST /api/skill/email — the "Send email" skill's transport.
 * Auth: Supabase session cookie (logged-in) or x-device-id header (guest),
 * same identity model as /api/store. Defaults to the owner's own address.
 */
export async function POST(request: NextRequest) {
  const target = await resolveStoreTarget(request).catch(() => null);
  if (!target) {
    return NextResponse.json({ error: "Not identified — sign in or send x-device-id" }, { status: 401 });
  }

  const who = `${target.kind}:${target.id}`;
  const now = Date.now();
  const recent = hits.filter((h) => h.who === who && now - h.at < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return NextResponse.json({ error: "Rate limit: 5 emails per 10 minutes" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const subject = String(body?.subject || "").trim().slice(0, 300);
  const text = String(body?.body || body?.text || "").trim().slice(0, 20_000);
  if (!subject || !text) {
    return NextResponse.json({ error: "Both subject and body are required" }, { status: 400 });
  }

  const store: any = await readStoreData(target).catch(() => ({}));
  const smtp = resolveSmtp(store?.settings?.prefs?.email);
  if (!smtp) {
    return NextResponse.json({ error: "Email not configured — set SMTP in Settings" }, { status: 503 });
  }

  const to = String(body?.to || smtp.user).trim().slice(0, 320);
  try {
    await sendMail(smtp, { to, subject, text });
  } catch (e: any) {
    return NextResponse.json({ error: `Send failed: ${e?.message || e}` }, { status: 502 });
  }

  hits.push({ who, at: now });
  return NextResponse.json({ ok: true, to });
}
