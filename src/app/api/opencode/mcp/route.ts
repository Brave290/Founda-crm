import { NextRequest, NextResponse } from "next/server";
import { addMcpServer, disconnectMcpServer, getMcpStatus } from "@/lib/opencode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const status = await getMcpStatus();
    return NextResponse.json({ servers: status });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, name, config } = await request.json();

    switch (action) {
      case "add": {
        const result = await addMcpServer(name, config);
        return NextResponse.json({ ok: true, result });
      }
      case "disconnect": {
        await disconnectMcpServer(name);
        return NextResponse.json({ ok: true });
      }
      case "status": {
        const status = await getMcpStatus();
        return NextResponse.json({ servers: status });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}