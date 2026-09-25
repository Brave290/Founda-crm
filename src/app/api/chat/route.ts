import { NextRequest, NextResponse } from "next/server";
import { ensureServer, setProviderAuth } from "@/lib/opencode";
import { buildModelChain, keyForModel } from "@/lib/models";
import { readStoreForRequest } from "@/lib/store-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function splitModel(m: string): { providerID: string; modelID: string } {
  const i = m.indexOf("/");
  return i === -1
    ? { providerID: m, modelID: "default" }
    : { providerID: m.slice(0, i), modelID: m.slice(i + 1) };
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, prompt, agent, model, systemPrompt } = await request.json();

    const client = await ensureServer();
    const directory = process.env.OPENCODE_WORKSPACE || "/tmp/oc-workspace";

    // Failover chain: requested model → every other available model
    const store = await readStoreForRequest(request).catch(() => null);
    const storeKeys = store?.settings?.apiKeys || {};
    const chain = buildModelChain(model, storeKeys, process.env);

    const applyKey = async (modelId: string) => {
      const k = keyForModel(modelId, storeKeys, process.env);
      if (!k) return;
      try { await setProviderAuth(k.provider, k.key); } catch {}
    };

    // Create session if not provided
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const createParams: any = {
        title: prompt?.slice(0, 60) || "New Chat",
        directory,
      };
      if (agent) createParams.agent = agent;
      const created: any = await client.session.create(createParams);
      targetSessionId = created?.data?.id;
      if (!targetSessionId) {
        throw new Error(
          "Failed to create opencode session: " +
            JSON.stringify(created?.error || created?.response?.status || created || "unknown")
        );
      }
    }

    // Try each model in the chain; quota/auth/model errors fall through
    let content = "";
    let usedModel = chain[0];
    const attempts: string[] = [];
    let lastError = "unknown error";

    for (const m of chain) {
      usedModel = m;
      attempts.push(m);
      try {
        await applyKey(m);
        const promptParams: any = {
          sessionID: targetSessionId,
          directory,
          parts: [{ type: "text", text: prompt }],
          model: splitModel(m),
        };
        if (agent) promptParams.agent = agent;
        if (systemPrompt) promptParams.system = systemPrompt;

        const result: any = await client.session.prompt(promptParams);
        if (!result?.data) {
          throw new Error(result?.error ? JSON.stringify(result.error) : "empty result");
        }
        const data = result.data;
        const info = data.info;
        if (info?.error) {
          const err: any = info.error;
          throw new Error(
            `[${err?.name || "unknown"}] ${err?.data ? JSON.stringify(err.data) : JSON.stringify(err)}`
          );
        }

        if (typeof data === "string") {
          content = data;
        } else if (data.text) {
          content = data.text;
        } else if (data.parts && Array.isArray(data.parts)) {
          content = data.parts
            .filter((p: any) => p.type === "text" && !p.synthetic)
            .map((p: any) => p.text || "")
            .join("");
        } else if (data.content) {
          content =
            typeof data.content === "string"
              ? data.content
              : JSON.stringify(data.content);
        }

        if (content || !isFailoverError(JSON.stringify(info || {}))) break;
        throw new Error("empty response");
      } catch (e: any) {
        lastError = e.message || "model error";
        if (!isFailoverError(lastError) || m === chain[chain.length - 1]) {
          if (m === chain[chain.length - 1] && !content) {
            throw new Error(`model error [${usedModel}]: ${lastError}`);
          }
          if (!content) throw new Error(`model error [${usedModel}]: ${lastError}`);
          break;
        }
        // else: continue to next model in chain
      }
    }

    if (!content) throw new Error(`model error [${usedModel}]: ${lastError}`);

    return NextResponse.json({
      content,
      sessionId: targetSessionId,
      metadata: {
        agent: agent || "build",
        model: usedModel,
        requestedModel: model || "default",
        fallback: attempts.length > 1 ? attempts : undefined,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "opencode error" },
      { status: 500 }
    );
  }
}

function isFailoverError(msg: string): boolean {
  const m = (msg || "").toLowerCase();
  return (
    m.includes("429") ||
    m.includes("rate") ||
    m.includes("quota") ||
    m.includes("limit") ||
    m.includes("billing") ||
    m.includes("credit") ||
    m.includes("auth") ||
    m.includes("api key") ||
    m.includes("apikey") ||
    m.includes("unauthorized") ||
    m.includes("forbidden") ||
    m.includes("not found") ||
    m.includes("model_not_found") ||
    m.includes("overloaded") ||
    m.includes("unavailable") ||
    m.includes("empty result") ||
    m.includes("empty response")
  );
}
