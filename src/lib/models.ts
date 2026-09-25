// Curated model catalog + availability resolution (server-side).

export interface CatalogModel {
  id: string; // full "provider/model" id sent to opencode
  label: string;
}

export interface CatalogProvider {
  provider: string; // opencode provider id (models.dev or custom config)
  label: string;
  /** env var that carries the key on the server, if any */
  env?: string;
  /** store apiKeys entry (Settings → API keys), if any */
  storeKey?: string;
  /** works with zero configuration */
  keyless?: boolean;
  models: CatalogModel[];
}

export const MODEL_CATALOG: CatalogProvider[] = [
  {
    provider: "pollinations",
    label: "Pollinations",
    keyless: true,
    models: [
      { id: "pollinations/openai-fast", label: "GPT-OSS 20B fast · free" },
      { id: "pollinations/openai", label: "GPT-OSS 20B · free" },
    ],
  },
];

export interface ResolvedModel extends CatalogModel {
  provider: string;
  providerLabel: string;
  available: boolean;
  source: "keyless" | "store" | "env" | "none";
}

function hasKey(p: CatalogProvider, storeKeys: Record<string, string>, env: NodeJS.ProcessEnv) {
  if (p.keyless) return "keyless" as const;
  if (p.storeKey && storeKeys[p.storeKey]) return "store" as const;
  if (p.env && env[p.env]) return "env" as const;
  return "none" as const;
}

export function resolveModels(
  storeKeys: Record<string, string> = {},
  env: NodeJS.ProcessEnv = process.env
): ResolvedModel[] {
  return MODEL_CATALOG.flatMap((p) => {
    const source = hasKey(p, storeKeys, env);
    return p.models.map((m) => ({
      ...m,
      provider: p.provider,
      providerLabel: p.label,
      available: source !== "none",
      source,
    }));
  });
}

/** App default: the latest free MiMo. */
export const DEFAULT_MODEL = "opencode/mimo-v2.6-flash-free";

/** Failover chain: requested model first, then every other available model. */
export function buildModelChain(
  requested: string | undefined,
  storeKeys: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env
): string[] {
  const available = resolveModels(storeKeys, env)
    .filter((m) => m.available)
    .map((m) => m.id);
  const chain: string[] = [];
  if (requested && !chain.includes(requested)) chain.push(requested);
  for (const id of available) if (!chain.includes(id)) chain.push(id);
  if (!chain.length) chain.push("pollinations/openai-fast");
  return chain;
}

/** Returns the env/store key for a full model id, if any. */
export function keyForModel(
  modelId: string,
  storeKeys: Record<string, string>,
  env: NodeJS.ProcessEnv = process.env
): { provider: string; key: string } | null {
  const provider = modelId.split("/")[0];
  const entry = MODEL_CATALOG.find((p) => p.provider === provider);
  if (!entry) return null;
  const key = (entry.storeKey && storeKeys[entry.storeKey]) || (entry.env && env[entry.env]);
  return key ? { provider, key } : null;
}

/** Merge opencode's native free catalog (opencode/* models like mimo, nemotron). */
export function mergeNativeModels(native: any[], storeKeys: Record<string, string> = {}, env: NodeJS.ProcessEnv = process.env): ResolvedModel[] {
  const seen = new Set(MODEL_CATALOG.flatMap((p) => p.models.map((m) => m.id)));
  const out: ResolvedModel[] = [];
  for (const m of native) {
    if (!m || m.enabled === false || m.status === "deprecated") continue;
    const id = `${m.providerID}/${m.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const isFree = m.providerID === "opencode";
    const entry = MODEL_CATALOG.find((p) => p.provider === m.providerID);
    const source: ResolvedModel["source"] = isFree
      ? "keyless"
      : entry
        ? hasKeyAny(entry, storeKeys, env)
        : "none";
    out.push({
      id,
      label: m.name || m.id,
      provider: m.providerID,
      providerLabel: isFree ? "opencode · free" : m.providerID,
      available: source !== "none",
      source,
    });
  }
  // free opencode models first
  out.sort((a, b) => Number(b.available) - Number(a.available));
  return out;
}

function hasKeyAny(p: CatalogProvider, storeKeys: Record<string, string>, env: NodeJS.ProcessEnv) {
  if (p.keyless) return "keyless" as const;
  if (p.storeKey && storeKeys[p.storeKey]) return "store" as const;
  if (p.env && env[p.env]) return "env" as const;
  return "none" as const;
}
