import { NextRequest, NextResponse } from "next/server";
import { ensureServer, getAvailableAgents, getProviders } from "@/lib/opencode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const agents = await getAvailableAgents();
    return NextResponse.json({ agents });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    if (action === "providers") {
      const providers = await getProviders();
      return NextResponse.json({ providers });
    }
    if (action === "health") {
      const client = await ensureServer();
      const health = await client.global.health();
      return NextResponse.json({ health: (health as any)?.data || "ok" });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}