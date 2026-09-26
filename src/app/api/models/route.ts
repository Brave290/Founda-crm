import { NextResponse } from "next/server";
import { resolveModels, mergeNativeModels } from "@/lib/models";
import { readStoreForRequest } from "@/lib/store-server";
import { listNativeModels, getLastError, getLatestNativeModel } from "@/lib/opencode";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const data = (await readStoreForRequest(req)) || {};
    const storeKeys = data.settings?.apiKeys || {};
    const native = await listNativeModels();
    const staticModels = resolveModels(storeKeys, process.env);
    const merged = mergeNativeModels(native, storeKeys, process.env);
    const defaultModel = await getLatestNativeModel();
    return NextResponse.json({ models: [...merged, ...staticModels], defaultModel, nativeCount: native.length, nativeError: getLastError() });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
