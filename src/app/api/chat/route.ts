import { NextRequest, NextResponse } from "next/server";
import { ensureServer, setProviderAuth, listNativeModels } from "@/lib/opencode";
import { buildModelChain, keyForModel } from "@/lib/models";
import { readStoreForRequest } from "@/lib/store-server";
import { stepFromPart } from "@/lib/agent-activity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function splitModel(m: string): { providerID: string; modelID: string } {
  const i = m.indexOf("/");
  return i === -1
    ? { providerID: m, modelID: "default" }
    : { providerID: m.slice(0, i), modelID: m.slice(i + 1) };
}

interface ChatOut {
  content: string;
  usedModel: string;
  attempts: string[];
  info?: any;
}

interface Prep {
  client: any;
  directory: string;
  agent?: string;
  systemPrompt?: string;
  requestedModel: string;
  hasImage: boolean;
  ocSession(): string | null;
  runWithRecovery(): Promise<ChatOut>;
  /** Called before each attempt (failover / recovery / image-drop) so streams can reset partial state. */
  onAttempt?: () => void;
}

async function prepare(request: NextRequest, body: any): Promise<Prep> {
  const { sessionId, prompt, agent, model, systemPrompt, image, history, replay: replayHint } = body;
  const hist: { role: string; content: string }[] = Array.isArray(history)
    ? history.slice(-12)
    : [];

  const client = await ensureServer();
  const directory = process.env.OPENCODE_WORKSPACE || "/tmp/oc-workspace";

  // Failover chain: requested model → opencode free → static available
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
  // Fresh sessions fold prior history into the prompt. Client may pre-create an
  // empty opencode session (for live activity polling) and explicitly ask to replay.
  let replay = typeof replayHint === "boolean" ? replayHint : !ocSession;

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
      prep.onAttempt?.();
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

  let imageDropped = false;

  const runWithRecovery = async (): Promise<ChatOut> => {
    const attempt = (withImage: boolean) => runChain(buildParts(withImage));
    try {
      return await attempt(true);
    } catch (e: any) {
      let recovered = false;
      let out: ChatOut | undefined;
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
      if (!out) throw e;
      if (imageDropped) (out as any).imageDropped = true;
      return out;
    }
  };

  const prep: Prep = {
    client,
    directory,
    agent,
    systemPrompt,
    requestedModel: model || "default",
    hasImage,
    ocSession: () => ocSession,
    runWithRecovery,
  };
  return prep;
}

/** Server-sent-events run: streams live activity + partial text while the prompt executes. */
function streamRun(prep: Prep): Response {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: any) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      const steps = new Map<string, any>();
      const textParts = new Map<string, string>();
      const assistantIds = new Set<string>();
      let todos: any[] = [];
      let busy = false;
      let activityTimer: ReturnType<typeof setTimeout> | null = null;
      let activityDirty = false;
      let textTimer: ReturnType<typeof setTimeout> | null = null;
      let textDirty = false;

      const flushActivity = () => {
        activityDirty = false;
        const list = [...steps.values()].slice(-60);
        send("activity", {
          busy: busy || list.some((s) => s.status === "running" || s.status === "pending"),
          todos,
          steps: list,
        });
      };
      const markActivity = () => {
        activityDirty = true;
        if (!activityTimer) activityTimer = setTimeout(() => { activityTimer = null; if (activityDirty) flushActivity(); }, 300);
      };
      const flushText = () => {
        if (!textDirty) return;
        textDirty = false;
        send("delta", { text: [...textParts.values()].join("") });
      };
      const markText = () => {
        textDirty = true;
        if (!textTimer) textTimer = setTimeout(() => { textTimer = null; if (textDirty) flushText(); }, 100);
      };

      // Failover/recovery restarts: drop partial state from the failed attempt.
      prep.onAttempt = () => {
        steps.clear();
        textParts.clear();
        busy = true;
        markActivity();
        markText();
      };

      const handle = (ev: any) => {
        if (closed) return;
        const p: any = ev && (ev.payload ?? ev);
        const type: string = p?.type || "";
        if (!type) return;
        const props: any = p.properties || {};
        const cur = prep.ocSession();
        if (props.sessionID && cur && props.sessionID !== cur) return;
        if (type === "session.status") {
          busy = props.status?.type === "busy";
          markActivity();
        } else if (type === "session.idle") {
          busy = false;
          markActivity();
        } else if (type === "todo.updated") {
          if (Array.isArray(props.todos)) todos = props.todos;
          markActivity();
        } else if (type === "message.updated") {
          const info = props.info;
          if (info?.id && info?.role === "assistant") assistantIds.add(info.id);
        } else if (type === "message.part.delta") {
          // incremental text (legacy stream)
          if (
            typeof props.delta === "string" && props.delta &&
            (!props.field || props.field === "text") &&
            props.messageID && assistantIds.has(props.messageID)
          ) {
            const key = props.partID || props.messageID;
            textParts.set(key, (textParts.get(key) || "") + props.delta);
            markText();
          }
        } else if (type === "session.next.text.delta") {
          if (typeof props.delta === "string" && props.delta && props.sessionID) {
            const key = props.textID || props.assistantMessageID || "next";
            textParts.set(key, (textParts.get(key) || "") + props.delta);
            markText();
          }
        } else if (type === "message.part.updated") {
          const part = props.part;
          if (!part) return;
          if (part.type === "text" && !part.synthetic && typeof part.text === "string" && part.text && part.messageID) {
            if (assistantIds.has(part.messageID)) {
              // authoritative accumulated text; never regress a longer value
              const cur = textParts.get(part.id) || "";
              if (part.text.length >= cur.length) {
                textParts.set(part.id, part.text);
                markText();
              }
            }
          } else if (part.type === "tool") {
            const step = stepFromPart(part);
            if (step) {
              steps.set(step.id, step);
              markActivity();
            }
          }
        }
      };

      (async () => {
        // Subscribe to engine events before prompting; give the SSE connection a
        // moment to establish so the first tool/text events aren't missed.
        let connected = false;
        (async () => {
          try {
            const sub: any = await prep.client.event.subscribe({ directory: prep.directory });
            connected = true;
            for await (const ev of sub.stream) {
              if (closed) break;
              handle(ev);
            }
          } catch {
            /* stream ended */
          }
        })();
        for (let i = 0; i < 10 && !connected; i++) await new Promise((r) => setTimeout(r, 50));
        await new Promise((r) => setTimeout(r, 100));

        try {
          const out = await prep.runWithRecovery();
          // The engine broadcasts the final text/tool part updates just after
          // prompt() resolves — capture them before declaring completion.
          await new Promise((r) => setTimeout(r, 300));
          flushText();
          if (activityDirty) flushActivity();
          send("done", {
            content: out.content,
            sessionId: prep.ocSession(),
            metadata: {
              agent: prep.agent || "build",
              model: out.usedModel,
              requestedModel: prep.requestedModel,
              fallback: out.attempts.length > 1 ? out.attempts : undefined,
              imageDropped: (out as any).imageDropped || undefined,
            },
          });
        } catch (e: any) {
          flushText();
          send("error", { error: e?.message || "opencode error" });
          send("debug", { types: [...dbgTypes.entries()], samples: dbgSamples, assistants: [...assistantIds] });
        } finally {
          if (activityTimer) clearTimeout(activityTimer);
          if (textTimer) clearTimeout(textTimer);
          close();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  try {
    const prep = await prepare(request, body);

    if (body.stream === true) {
      return streamRun(prep);
    }

    const out = await prep.runWithRecovery();
    return NextResponse.json({
      content: out.content,
      sessionId: prep.ocSession(),
      metadata: {
        agent: body.agent || "build",
        model: out.usedModel,
        requestedModel: prep.requestedModel,
        fallback: out.attempts.length > 1 ? out.attempts : undefined,
        imageDropped: (out as any).imageDropped || undefined,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "opencode error" },
      { status: 500 }
    );
  }
}
