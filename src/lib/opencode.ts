import { createOpencode, type OpencodeClient } from "@opencode-ai/sdk/v2";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

let client: OpencodeClient | null = null;
let serverUrl: string | null = null;
let serverClose: (() => void) | null = null;

const OPENCODE_DIR = path.join(process.cwd(), ".opencode-runtime");
const OPENCODE_BIN = path.join(OPENCODE_DIR, "bin", "opencode");
const INSTALL_DIR = process.env.OPENCODE_HOME || OPENCODE_DIR;

// --- Install / Auto-Update ---

export function isInstalled(): boolean {
  try {
    if (fs.existsSync(OPENCODE_BIN)) return true;
    // Also check system-installed opencode
    execSync("which opencode", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

export function getOpencodeVersion(): string | null {
  try {
    const bin = getOpencodePath();
    if (!bin) return null;
    const out = execSync(`"${bin}" --version`, { encoding: "utf-8", stdio: "pipe" });
    return out.trim();
  } catch {
    return null;
  }
}

function getOpencodePath(): string | null {
  if (fs.existsSync(OPENCODE_BIN)) return OPENCODE_BIN;
  try {
    const p = execSync("which opencode", { encoding: "utf-8", stdio: "pipe" }).trim();
    if (p) return p;
  } catch {}
  return null;
}

export async function installOpencode(): Promise<{ success: boolean; message: string }> {
  try {
    // Official opencode install script
    execSync(
      `curl -fsSL https://opencode.ai/install | bash`,
      { stdio: "pipe", timeout: 120_000, shell: "/bin/bash" }
    );
    return { success: true, message: "opencode installed successfully" };
  } catch (e: any) {
    return { success: false, message: `Install failed: ${e.message}` };
  }
}

export async function upgradeOpencode(): Promise<{ success: boolean; message: string }> {
  try {
    execSync(
      `curl -fsSL https://opencode.ai/install | bash -s -- latest`,
      { stdio: "pipe", timeout: 120_000, shell: "/bin/bash" }
    );
    return { success: true, message: "opencode upgraded to latest version" };
  } catch (e: any) {
    return { success: false, message: `Upgrade failed: ${e.message}` };
  }
}

// --- Server Lifecycle ---

export async function ensureServer(): Promise<OpencodeClient> {
  if (client) {
    try {
      await client.global.health();
      return client;
    } catch {
      // Server died, restart
      client = null;
      serverUrl = null;
    }
  }

  if (!isInstalled()) {
    const result = await installOpencode();
    if (!result.success) {
      throw new Error(
        "opencode is not installed and auto-install failed. Run: curl -fsSL https://opencode.ai/install | bash"
      );
    }
  }

  const binPath = getOpencodePath();
  if (!binPath) {
    throw new Error("opencode binary not found after install");
  }

  const result = await createOpencode({
    config: {} as any,
  });

  client = result.client;
  serverUrl = result.server.url;
  serverClose = result.server.close;

  return client;
}

export function getServerUrl(): string | null {
  return serverUrl;
}

export async function shutdownServer() {
  if (serverClose) {
    serverClose();
    serverClose = null;
  }
  client = null;
  serverUrl = null;
}

// --- Free Built-in Agents (opencode's own free agents) ---

const FREE_AGENTS = [
  {
    id: "build",
    name: "Build",
    description: "Default coding agent — writes, edits, and builds code",
    free: true,
  },
  {
    id: "plan",
    name: "Plan",
    description: "Read-only agent for analyzing and planning",
    free: true,
  },
  {
    id: "general",
    name: "General",
    description: "General-purpose assistant for any task",
    free: true,
  },
  {
    id: "explore",
    name: "Explore",
    description: "Codebase exploration and search agent",
    free: true,
  },
];

export async function getAvailableAgents(): Promise<any[]> {
  try {
    const c = await ensureServer();
    const res = await c.app.agents({});
    const data = await res;
    if (data && Array.isArray((data as any).data)) {
      return (data as any).data.map((a: any) => ({
        id: a.id || a.name,
        name: a.name || a.id,
        description: a.description || "",
        free: true,
        source: "opencode",
      }));
    }
    if (data && Array.isArray(data as any)) {
      return (data as any).map((a: any) => ({
        id: a.id || a.name,
        name: a.name || a.id,
        description: a.description || "",
        free: true,
        source: "opencode",
      }));
    }
  } catch {
    // Fallback to known free agents
  }
  return FREE_AGENTS;
}

// --- Provider / Model Info ---

export async function getProviders(): Promise<any[]> {
  try {
    const c = await ensureServer();
    const res = await c.provider.list({});
    return (res as any)?.data || [];
  } catch {
    return [];
  }
}

// --- MCP ---

export async function addMcpServer(name: string, config: any): Promise<any> {
  const c = await ensureServer();
  const res = await c.mcp.add({ name, config });
  return (res as any)?.data;
}

export async function getMcpStatus(): Promise<any> {
  try {
    const c = await ensureServer();
    const res = await c.mcp.status({});
    return (res as any)?.data || [];
  } catch {
    return [];
  }
}

// --- API Keys / Auth ---

export async function setProviderAuth(providerID: string, apiKey: string) {
  const c = await ensureServer();
  const res = await c.auth.set({
    providerID,
    auth: { type: "api-key", key: apiKey } as any,
  });
  return (res as any)?.data;
}

export async function removeProviderAuth(providerID: string) {
  const c = await ensureServer();
  const res = await c.auth.remove({ providerID });
  return (res as any)?.data;
}
