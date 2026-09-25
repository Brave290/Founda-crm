#!/usr/bin/env node
// Downloads the opencode binary at build time so it ships with the deployment.
// Always exits 0 — a missing binary must never fail the build (runtime install
// in src/lib/opencode.ts remains as a fallback).
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const VERSION = process.env.OPENCODE_VERSION || "v1.18.32";
const ROOT = process.cwd();
const BIN_DIR = path.join(ROOT, ".opencode", "bin");
const BIN = path.join(BIN_DIR, process.platform === "win32" ? "opencode.exe" : "opencode");

const ASSETS = {
  "linux-x64": "opencode-linux-x64.tar.gz",
  "linux-arm64": "opencode-linux-arm64.tar.gz",
  "darwin-x64": "opencode-darwin-x64.tar.gz",
  "darwin-arm64": "opencode-darwin-arm64.tar.gz",
};

const log = (m) => console.log(`[fetch-opencode] ${m}`);

// Build-info marker ships inside .opencode/bin (traced into API functions) so
// production can report what happened at build time.
function marker(status, message) {
  try {
    fs.mkdirSync(BIN_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(BIN_DIR, "build-info.txt"),
      `status=${status}\nversion=${VERSION}\nplatform=${process.platform}-${process.arch}\nmessage=${message}\nat=${new Date().toISOString()}\n`
    );
  } catch {}
}

function usable(bin) {
  try {
    execSync(`"${bin}" --version`, { stdio: "pipe", timeout: 20000 });
    return true;
  } catch {
    return false;
  }
}

try {
  if (fs.existsSync(BIN)) {
    if (usable(BIN)) {
      log(`already bundled: ${execSync(`"${BIN}" --version`, { stdio: "pipe" }).toString().trim()}`);
      marker("ok", "reused existing binary");
      process.exit(0);
    }
    log("existing binary not runnable — re-downloading");
  }

  const key = `${process.platform}-${process.arch}`;
  const asset = ASSETS[key];
  if (!asset) {
    log(`no release asset for ${key} — skipping (runtime install will cover it)`);
    marker("skipped", `no asset for ${key}`);
    process.exit(0);
  }

  const url = `https://github.com/anomalyco/opencode/releases/download/${VERSION}/${asset}`;
  const tmp = path.join(os.tmpdir(), asset);
  const extractDir = path.join(os.tmpdir(), `opencode-extract-${Date.now()}`);

  fs.mkdirSync(BIN_DIR, { recursive: true });
  fs.mkdirSync(extractDir, { recursive: true });

  log(`downloading ${asset} (${VERSION})…`);
  execSync(
    `curl -fsSL --connect-timeout 10 --max-time 300 --retry 2 -o "${tmp}" "${url}"`,
    { stdio: "inherit", timeout: 320_000, shell: "/bin/bash" }
  );
  execSync(`tar -xzf "${tmp}" -C "${extractDir}"`, { stdio: "pipe", timeout: 60_000 });

  // Locate the binary inside the archive (top level or nested)
  let found = null;
  const walk = (dir, depth) => {
    if (found || depth > 3) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isFile() && (entry.name === "opencode" || entry.name === "opencode.exe")) {
        found = p;
        return;
      }
      if (entry.isDirectory()) walk(p, depth + 1);
      if (found) return;
    }
  };
  walk(extractDir, 0);

  if (!found) throw new Error("binary not found inside archive");

  fs.renameSync(found, BIN);
  fs.chmodSync(BIN, 0o755);
  fs.rmSync(tmp, { force: true });
  fs.rmSync(extractDir, { recursive: true, force: true });

  if (usable(BIN)) {
    const v = execSync(`"${BIN}" --version`, { stdio: "pipe" }).toString().trim();
    log(`bundled: ${v}`);
    marker("ok", v);
  } else {
    log("downloaded, but runtime verification failed on this machine (expected when cross-platform)");
    marker("downloaded-unverified", "cross-platform binary, verify on server");
  }
} catch (e) {
  log(`download skipped (non-fatal): ${e.message}`);
  marker("failed", e.message);
}
process.exit(0);
