import { NextRequest, NextResponse } from "next/server";
import { ensureServer, upgradeOpencode } from "@/lib/opencode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const client = await ensureServer();
    const health = await client.global.health();
    return NextResponse.json({ status: "ok", health: (health as any)?.data });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", error: error.message },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    if (action === "upgrade") {
      const result = await upgradeOpencode();
      return NextResponse.json(result, {
        status: result.success ? 200 : 500,
      });
    }
    if (action === "restart") {
      const { shutdownServer } = await import("@/lib/opencode");
      await shutdownServer();
      const client = await ensureServer();
      return NextResponse.json({ status: "restarted" });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}