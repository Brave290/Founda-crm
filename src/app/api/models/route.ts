import { NextResponse } from "next/server";
import { resolveModels } from "@/lib/models";
import { readStoreForRequest } from "@/lib/store-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const data = (await readStoreForRequest(req)) || {};
    const storeKeys = data.settings?.apiKeys || {};
    const models = resolveModels(storeKeys, process.env);
    return NextResponse.json({ models });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
