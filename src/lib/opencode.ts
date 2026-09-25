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
const OPENCODE_VERSION = process.env.OPENCODE_VERSION || "v1.18.32";

function logSafe(m: string) {
  try { console.error(`[opencode] ${m}`); } catch {}
}

function findBinary(dir: string, depth: number): string | null {
  if (depth > 3) return null;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isFile() && (e.name === "opencode" || e.name === "opencode.exe")) return p;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      const found = findBinary(p0(e, dir), depth + 1);
      if (found) return found;
    }
  }
  return null;
}
function p0(e: fs.Dirent, dir: string) { return path.join(dir, e.name); }

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

export function opencodeDiagnostics() {
  const candidates = binaryCandidates().map((c) => {
    let size = -1;
    try { size = fs.statSync(c).size; } catch {}
    return { path: c, exists: size >= 0, size };
  });
  let buildInfo = null;
  try { buildInfo = fs.readFileSync(path.join(BUNDLED_BIN, "..", "build-info.txt"), "utf8"); } catch {}
  let systemPath = null;
  try { systemPath = execSync("command -v opencode", { encoding: "utf-8", stdio: "pipe", env: process.env }).trim(); } catch {}
  return {
    cwd: process.cwd(),
    home: process.env.HOME,
    binPath: getOpencodePath(),
    candidates,
    systemPath,
    buildInfo,
    pathHead: (process.env.PATH || "").split(":").slice(0, 4),
  };
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
    logSafe("install script did not produce a binary, trying direct download");
  } catch (e: any) {
    logSafe(`install script failed (${e.message}), trying direct download`);
  }

  // Fallback: pull the release tarball directly (works without HOME/sudo)
  try {
    const key = `${process.platform}-${process.arch}`;
    const assets: Record<string, string> = {
      "linux-x64": "opencode-linux-x64.tar.gz",
      "linux-arm64": "opencode-linux-arm64.tar.gz",
      "darwin-x64": "opencode-darwin-x64.tar.gz",
      "darwin-arm64": "opencode-darwin-arm64.tar.gz",
    };
    const asset = assets[key];
    if (!asset) return { success: false, message: `No opencode build for ${key}` };
    const binDir = path.join(process.env.HOME!, ".opencode", "bin");
    fs.mkdirSync(binDir, { recursive: true });
    const tar = path.join(os.tmpdir(), asset);
    const url = `https://github.com/anomalyco/opencode/releases/download/${OPENCODE_VERSION}/${asset}`;
    execSync(`curl -fsSL --connect-timeout 10 --max-time 300 --retry 2 -o "${tar}" "${url}"`, {
      stdio: "pipe", timeout: 320_000, shell: "/bin/bash", env: process.env,
    });
    const extract = path.join(os.tmpdir(), `oc-extract-${Date.now()}`);
    fs.mkdirSync(extract, { recursive: true });
    execSync(`tar -xzf "${tar}" -C "${extract}"`, { stdio: "pipe", timeout: 60_000 });
    const found = findBinary(extract, 0);
    if (!found) throw new Error("binary not found in archive");
    const dest = path.join(binDir, "opencode");
    fs.renameSync(found, dest);
    fs.chmodSync(dest, 0o755);
    fs.rmSync(tar, { force: true });
    fs.rmSync(extract, { recursive: true, force: true });
    ensureRuntimeEnv();
    if (isInstalled()) return { success: true, message: "opencode installed (direct download)" };
    return { success: false, message: "Downloaded but binary still not resolvable" };
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
