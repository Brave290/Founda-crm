import { NextRequest, NextResponse } from "next/server";
import { ensureServer } from "@/lib/opencode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}) as any);
    const title = typeof body.title === "string" ? body.title.slice(0, 80) : "New chat";
    const agent = typeof body.agent === "string" && body.agent ? body.agent : undefined;

    const client: any = await ensureServer();
    const directory = process.env.OPENCODE_WORKSPACE || "/tmp/oc-workspace";
    const createParams: any = { title: title || "New Chat", directory };
    if (agent) createParams.agent = agent;
    const created: any = await client.session.create(createParams);
    if (!created?.data?.id) {
      return NextResponse.json(
        { error: "Failed to create session: " + JSON.stringify(created?.error || "unknown") },
        { status: 500 }
      );
    }
    return NextResponse.json({ sessionId: created.data.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
