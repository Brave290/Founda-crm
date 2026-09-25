import { NextRequest, NextResponse } from "next/server";
import {
  isInstalled,
  installOpencode,
  upgradeOpencode,
  getOpencodeVersion,
  opencodeDiagnostics,
} from "@/lib/opencode";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const installed = isInstalled();
    const version = getOpencodeVersion();
    return NextResponse.json({ installed, version, diag: opencodeDiagnostics() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    switch (action) {
      case "install": {
        const result = await installOpencode();
        return NextResponse.json(result, {
          status: result.success ? 200 : 500,
        });
      }
      case "upgrade": {
        const result = await upgradeOpencode();
        return NextResponse.json(result, {
          status: result.success ? 200 : 500,
        });
      }
      case "check": {
        const installed = isInstalled();
        const version = getOpencodeVersion();
        return NextResponse.json({ installed, version });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}