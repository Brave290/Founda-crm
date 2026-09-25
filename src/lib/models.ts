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
  {
    provider: "groq",
    label: "Groq",
    env: "GROQ_API_KEY",
    storeKey: "groq",
    models: [
      { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B · free tier" },
      { id: "groq/llama-3.1-8b-instant", label: "Llama 3.1 8B · free tier" },
    ],
  },
  {
    provider: "google",
    label: "Google Gemini",
    env: "GEMINI_API_KEY",
    storeKey: "gemini",
    models: [
      { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash · free tier" },
      { id: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash · free tier" },
    ],
  },
  {
    provider: "openrouter",
    label: "OpenRouter",
    env: "OPENROUTER_API_KEY",
    storeKey: "openrouter",
    models: [
      { id: "openrouter/deepseek/deepseek-chat-v3-0324:free", label: "DeepSeek V3 · free" },
      { id: "openrouter/meta-llama/llama-3.3-70b-instruct:free", label: "Llama 3.3 70B · free" },
    ],
  },
  {
    provider: "mistral",
    label: "Mistral",
    env: "MISTRAL_API_KEY",
    storeKey: "mistral",
    models: [
      { id: "mistral/mistral-small-latest", label: "Mistral Small · free tier" },
    ],
  },
  {
    provider: "cerebras",
    label: "Cerebras",
    env: "CEREBRAS_API_KEY",
    storeKey: "cerebras",
    models: [
      { id: "cerebras/llama-3.3-70b", label: "Llama 3.3 70B · free tier" },
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
