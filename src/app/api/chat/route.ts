import { NextRequest, NextResponse } from "next/server";
import { ensureServer, setProviderAuth, listNativeModels } from "@/lib/opencode";
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
    const { sessionId, prompt, agent, model, systemPrompt, image, history } =
      await request.json();
    const hist: { role: string; content: string }[] = Array.isArray(history)
      ? history.slice(-12)
      : [];

    const client = await ensureServer();
    const directory = process.env.OPENCODE_WORKSPACE || "/tmp/oc-workspace";

    // Failover chain: requested model → every other available model
    const store = await readStoreForRequest(request).catch(() => null);
    const storeKeys = store?.settings?.apiKeys || {};
    const staticChain = buildModelChain(model, storeKeys, process.env);
    const nativeFree = (await listNativeModels())
      .filter((m: any) => m?.providerID === "opencode" && m?.enabled !== false && m?.status !== "deprecated")
      .slice(0, 5)
      .map((m: any) => `opencode/${m.id}`);
    const chain: string[] = [];
    for (const id of [model || "", ...nativeFree, ...staticChain]) {
      if (id && !chain.includes(id)) chain.push(id);
    }

    const applyKey = async (modelId: string) => {
      const k = keyForModel(modelId, storeKeys, process.env);
      if (!k) return;
      try { await setProviderAuth(k.provider, k.key); } catch {}
    };

    const hasImage = typeof image === "string" && image.startsWith("data:image/");
    const buildParts = (withImage: boolean) => {
      const parts: any[] = [{ type: "text", text: promptText() }];
      if (withImage && hasImage) {
        const mime = image.slice(5, image.indexOf(";")) || "image/png";
        parts.push({ type: "file", mime, filename: "attachment", url: image });
      }
      return parts;
    };

    // Only opencode-native session ids (ses_*) are usable — Supabase UUIDs from
    // old clients are ignored and a fresh session is created with history replay.
    const sessionFromClient = typeof sessionId === "string" && sessionId.startsWith("ses_");
    let ocSession: string | null = sessionFromClient ? sessionId : null;
    let replay = !ocSession; // fresh session → fold conversation history into the prompt

    const createSession = async () => {
      const createParams: any = {
        title: prompt?.slice(0, 60) || "New Chat",
        directory,
      };
      if (agent) createParams.agent = agent;
      const created: any = await client.session.create(createParams);
      if (!created?.data?.id) {
        throw new Error(
          "Failed to create opencode session: " +
            JSON.stringify(created?.error || created?.response?.status || created || "unknown")
        );
      }
      ocSession = created.data.id;
      return ocSession;
    };
    if (!ocSession) await createSession();

    const promptText = () => {
      if (!replay || !hist.length) return prompt;
      const ctx = hist
        .map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${String(h.content || "").slice(0, 1500)}`)
        .join("\n");
      return `Conversation so far:\n${ctx}\n\nUser: ${prompt}`;
    };

    // Try each model in the chain; any prompt error falls through to the next.
    const runChain = async (parts: any[]) => {
      const attempts: string[] = [];
      let usedModel = chain[0];
      let lastError = "unknown error";
      for (const m of chain) {
        usedModel = m;
        attempts.push(m);
        try {
          await applyKey(m);
          const promptParams: any = {
            sessionID: ocSession!,
            directory,
            parts,
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

          let content = "";
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

          if (content) return { content, usedModel, attempts, info };
          throw new Error("empty response");
        } catch (e: any) {
          lastError = e.message || "model error";
          if (m === chain[chain.length - 1]) {
            throw new Error(`model error [${usedModel}]: ${lastError}`);
          }
        }
      }
      throw new Error(`model error [${usedModel}]: ${lastError}`);
    };

    let out: { content: string; usedModel: string; attempts: string[]; info?: any } | undefined;
    let imageDropped = false;
    const attempt = (withImage: boolean) => runChain(buildParts(withImage));

    try {
      out = await attempt(true);
    } catch (e: any) {
      let recovered = false;
      // Stale ses_* id from a recycled instance → recreate with history replay
      if (sessionFromClient && !replay) {
        replay = true;
        try {
          await createSession();
          out = await attempt(true);
          recovered = true;
        } catch {
          /* fall through */
        }
      }
      if (!recovered) {
        if (hasImage) {
          out = await attempt(false);
          imageDropped = true;
        } else throw e;
      }
    }

    if (!out) throw new Error("model failed");

    return NextResponse.json({
      content: out.content,
      sessionId: ocSession,
      metadata: {
        agent: agent || "build",
        model: out.usedModel,
        requestedModel: model || "default",
        fallback: out.attempts.length > 1 ? out.attempts : undefined,
        imageDropped: imageDropped || undefined,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "opencode error" },
      { status: 500 }
    );
  }
}
