import crypto from "crypto";

// Short-lived bearer the chat route injects into the system prompt so the
// model can call the app's own skill APIs (email, fetch, search, image).
// HMAC-signed with a server secret — stateless, works across serverless
// instances, expires quickly so a leaked prompt is worthless.

const SECRET = process.env.SKILL_TOKEN_SECRET || "founda-skill-secret";
const TTL_MS = 10 * 60 * 1000;

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

export function issueSkillToken(owner: { kind: string; id: string }): string {
  const payload = b64url(JSON.stringify({ k: owner.kind, id: owner.id, exp: Date.now() + TTL_MS }));
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySkillToken(token: string): { kind: string; id: string } | null {
  try {
    const [payload, sig] = String(token).split(".");
    if (!payload || !sig) return null;
    const expect = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expect);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!d || typeof d.id !== "string" || !d.id) return null;
    if (typeof d.exp !== "number" || d.exp < Date.now()) return null;
    return { kind: d.k === "user" ? "user" : "user", id: d.id };
  } catch {
    return null;
  }
}
