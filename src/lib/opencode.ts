import { createOpencode, type OpencodeClient } from "@opencode-ai/sdk/v2";
import { execSync, spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

let client: OpencodeClient | null = null;
let serverUrl: string | null = null;
let serverClose: (() => void) | null = null;

const OPENCODE_DIR = path.join(process.cwd(), ".opencode-runtime");
const BUNDLED_BIN = path.join(process.cwd(), ".opencode", "bin", "opencode");
const RUNTIME_BIN = path.join(OPENCODE_DIR, "bin", "opencode");
const INSTALL_DIR = process.env.OPENCODE_HOME || OPENCODE_DIR;

// --- Runtime environment (Vercel has no HOME; bundled binary lives in cwd) ---

function ensureRuntimeEnv() {
  if (!process.env.HOME || process.env.HOME === "undefined") {
    process.env.HOME = path.join(os.tmpdir(), "opencode-home");
  }
  if (!process.env.SHELL) process.env.SHELL = "/bin/bash";
  try {
    fs.mkdirSync(process.env.HOME, { recursive: true });
    fs.mkdirSync(path.join(process.env.HOME, ".opencode", "bin"), { recursive: true });
  } catch {}
  const bin = getOpencodePath();
  const dir = bin ? path.dirname(bin) : path.dirname(BUNDLED_BIN);
  const pathParts = (process.env.PATH || "").split(":");
  if (!pathParts.includes(dir)) process.env.PATH = `${dir}:${process.env.PATH || ""}`;
}
ensureRuntimeEnv();

// --- Binary resolution (bundled at build time > runtime install > system) ---

function binaryCandidates(): string[] {
  const home = process.env.HOME && process.env.HOME !== "undefined" ? process.env.HOME : os.homedir();
  return [...new Set([
    BUNDLED_BIN,
    RUNTIME_BIN,
    path.join(home, ".opencode", "bin", "opencode"),
    path.join(os.homedir(), ".opencode", "bin", "opencode"),
  ])];
}

function getOpencodePath(): string | null {
  for (const c of binaryCandidates()) {
    try {
      if (fs.existsSync(c)) {
        try { fs.chmodSync(c, 0o755); } catch {}
        return c;
      }
    } catch {}
  }
  try {
    const p = execSync("command -v opencode", {
      encoding: "utf-8",
      stdio: "pipe",
      env: process.env,
    }).trim();
    if (p && fs.existsSync(p)) return p;
  } catch {}
  return null;
}

export function isInstalled(): boolean {
  return getOpencodePath() !== null;
}

export function getOpencodeVersion(): string | null {
  try {
    const bin = getOpencodePath();
    if (!bin) return null;
    const out = execSync(`"${bin}" --version`, {
      encoding: "utf-8",
      stdio: "pipe",
      env: process.env,
      timeout: 15_000,
    });
    return out.trim();
  } catch {
    return null;
  }
}

export async function installOpencode(): Promise<{ success: boolean; message: string }> {
  try {
    ensureRuntimeEnv();
    // Official opencode install script — HOME/SHELL are guaranteed set above
    execSync(`curl -fsSL https://opencode.ai/install | bash -s -- --no-modify-path`, {
      stdio: "pipe",
      timeout: 120_000,
      shell: "/bin/bash",
      env: process.env,
    });
    ensureRuntimeEnv();
    if (isInstalled()) return { success: true, message: "opencode installed successfully" };
    return { success: false, message: "Install script ran but binary was not found" };
  } catch (e: any) {
    return { success: false, message: `Install failed: ${e.message}` };
  }
}

export async function upgradeOpencode(): Promise<{ success: boolean; message: string }> {
  try {
    ensureRuntimeEnv();
    execSync(`curl -fsSL https://opencode.ai/install | bash -s -- --no-modify-path latest`, {
      stdio: "pipe",
      timeout: 120_000,
      shell: "/bin/bash",
      env: process.env,
    });
    return { success: true, message: "opencode upgraded to latest version" };
  } catch (e: any) {
    return { success: false, message: `Upgrade failed: ${e.message}` };
  }
}

// --- Server Lifecycle ---

export async function ensureServer(): Promise<OpencodeClient> {
  ensureRuntimeEnv();

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
        "opencode engine unavailable (binary missing and auto-install failed)"
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
