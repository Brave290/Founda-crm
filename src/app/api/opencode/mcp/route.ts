import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addMcpServer, disconnectMcpServer, getMcpStatus } from "@/lib/opencode";
import { resolveStoreTarget } from "@/lib/store-server";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
function ownerId(owner: any): string | null { return owner?.kind === "user" ? owner.id : null; }
function liveName(s: any): string { return String(s?.name || s?.id || ""); }
function publicRow(row: any) {
  return { name: row.name, transport: row.transport, url: row.url, command: row.command, args: row.args || [], is_connected: row.is_connected, status: row.is_connected ? "connected" : "configured" };
}
async function requireOwner(req: Request) {
  const owner = await resolveStoreTarget(req);
  const id = ownerId(owner);
  return id ? { kind: "user" as const, id } : null;
}
export async function GET(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { data: rows, error } = await supa.from("mcp_connections").select("name,transport,url,command,args,is_connected").eq("user_id", owner.id).order("name").limit(100);
    if (error) throw error;
    const live = await getMcpStatus();
    const liveByName = new Map((Array.isArray(live) ? live : []).map((x: any) => [liveName(x).toLowerCase(), x]));
    const servers = (rows || []).map((r: any) => {
      const live = liveByName.get(String(r.name).toLowerCase()) as any;
      return { ...publicRow(r), status: live?.status || (r.is_connected ? "connected" : "configured") };
    });
    return NextResponse.json({ servers });
  } catch (e: any) { return NextResponse.json({ error: e.message || "MCP status failed" }, { status: 500 }); }
}
export async function POST(request: NextRequest) {
  const owner = await requireOwner(request);
  if (!owner) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { action, name, config } = await request.json();
    const cleanName = String(name || "").trim().slice(0, 120);
    if (!cleanName) return NextResponse.json({ error: "MCP name required" }, { status: 400 });
    if (action === "add") {
      if (!config || typeof config !== "object") return NextResponse.json({ error: "MCP config required" }, { status: 400 });
      const result = await addMcpServer(cleanName, config);
      const command = Array.isArray(config.command) ? String(config.command[0] || "") : null;
      const args = Array.isArray(config.command) ? config.command.slice(1) : [];
      const headers = config.headers || {};
      const authToken = typeof headers.Authorization === "string" ? headers.Authorization.slice(7) : null;
      const { error } = await supa.from("mcp_connections").upsert({
        user_id: owner.id, name: cleanName, transport: config.type === "local" ? "stdio" : "http",
        command, args, url: config.url || null, is_connected: true, auth_type: authToken ? "bearer" : config.oauth ? "oauth" : null, auth_token: authToken,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,name" });
      if (error) throw error;
      return NextResponse.json({ ok: true, result });
    }
    if (action === "disconnect") {
      await disconnectMcpServer(cleanName);
      const { error } = await supa.from("mcp_connections").delete().eq("user_id", owner.id).eq("name", cleanName);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if (action === "status") return GET(request);
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) { return NextResponse.json({ error: e.message || "MCP operation failed" }, { status: 500 }); }
}
