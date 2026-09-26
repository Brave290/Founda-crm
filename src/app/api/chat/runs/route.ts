import { NextRequest, NextResponse } from "next/server";
import { resolveStoreTarget } from "@/lib/store-server";
import { listRuns } from "@/lib/chat-runs";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat/runs?session=<client session id>
 * All background runs for this session — the chat page reconciles them on
 * load, so results produced while the user was away still show up.
 */
export async function GET(req: NextRequest) {
  const t = await resolveStoreTarget(req);
  if (!t) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const session = req.nextUrl.searchParams.get("session") || "";
  if (!session) return NextResponse.json({ runs: [] });
  const runs = await listRuns(t, session);
  return NextResponse.json({ runs });
}
