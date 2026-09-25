import { NextResponse } from "next/server";
import { resolveModels, mergeNativeModels } from "@/lib/models";
import { readStoreForRequest } from "@/lib/store-server";
import { listNativeModels } from "@/lib/opencode";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const data = (await readStoreForRequest(req)) || {};
    const storeKeys = data.settings?.apiKeys || {};
    const native = await listNativeModels();
    const staticModels = resolveModels(storeKeys, process.env);
    const merged = mergeNativeModels(native, storeKeys, process.env);
    return NextResponse.json({ models: [...merged, ...staticModels] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
