import { NextRequest, NextResponse } from "next/server";
import { setProviderAuth, removeProviderAuth, getProviders } from "@/lib/opencode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const providers = await getProviders();
    return NextResponse.json({ providers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, providerID, apiKey } = await request.json();

    switch (action) {
      case "set_key": {
        if (!providerID || !apiKey) {
          return NextResponse.json(
            { error: "providerID and apiKey required" },
            { status: 400 }
          );
        }
        await setProviderAuth(providerID, apiKey);
        return NextResponse.json({ success: true });
      }
      case "remove_key": {
        if (!providerID) {
          return NextResponse.json(
            { error: "providerID required" },
            { status: 400 }
          );
        }
        await removeProviderAuth(providerID);
        return NextResponse.json({ success: true });
      }
      case "list": {
        const providers = await getProviders();
        return NextResponse.json({ providers });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}