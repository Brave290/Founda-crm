import { NextResponse } from "next/server";
import { resolveModels, mergeNativeModels } from "@/lib/models";
import { readStoreForRequest } from "@/lib/store-server";
import { listNativeModels, getLastError } from "@/lib/opencode";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const data = (await readStoreForRequest(req)) || {};
    const storeKeys = data.settings?.apiKeys || {};
    const native = await listNativeModels();
    let nativeRaw = null;
    try {
      const c: any = await (await import("@/lib/opencode")).ensureServer();
      const r: any = await c.v2.model.list({ location: { directory: process.env.OPENCODE_WORKSPACE || "/tmp/oc-workspace" } });
      nativeRaw = JSON.stringify({ data: r?.data, error: r?.error }).slice(0, 600);
    } catch (e: any) { nativeRaw = "EXC: " + String(e?.message || e).slice(0, 300); }
    const staticModels = resolveModels(storeKeys, process.env);
    const merged = mergeNativeModels(native, storeKeys, process.env);
    return NextResponse.json({ models: [...merged, ...staticModels], nativeCount: native.length, nativeError: getLastError(), nativeRaw });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
