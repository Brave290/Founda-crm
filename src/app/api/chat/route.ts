import { NextRequest, NextResponse } from "next/server";
import { ensureServer, setProviderAuth, listNativeModels } from "@/lib/opencode";
import { buildModelChain, keyForModel, DEFAULT_MODEL } from "@/lib/models";
import { readStoreForRequest } from "@/lib/store-server";
import { stepFromPart } from "@/lib/agent-activity";
import { buildSkillsPrompt } from "@/lib/skills";

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
  // Plugin skills (catalog + user's enabled set from store prefs) ride along
  // as extra system text so the model knows exactly what it can do.
  const skillsPrompt = buildSkillsPrompt(store?.settings?.prefs);
  // Give the model its per-session identity so skill endpoints (e.g. the
  // email mailer) can authenticate the caller like /api/store does.
  const deviceId = request.headers.get("x-device-id");
  const skillsWithIdentity = deviceId
    ? `${skillsPrompt}\n\nYour identity for this app's APIs: send header "x-device-id: ${deviceId}" whenever a skill instructs you to call this app's own API (the ${deviceId} placeholder in skill text means this value).`
    : skillsPrompt;
  const storeKeys = store?.settings?.apiKeys || {};
  const staticChain = buildModelChain(model, storeKeys, process.env);
  const nativeFree = (await listNativeModels())
    .filter((m: any) => m?.providerID === "opencode" && m?.enabled !== false && m?.status !== "deprecated")
    .slice(0, 5)
    .map((m: any) => `opencode/${m.id}`);
  const chain: string[] = [];
  // Latest MiMo is the app default when the user hasn't picked a model.
  for (const id of [model || "", model ? "" : DEFAULT_MODEL, ...nativeFree, ...staticChain]) {
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
        const skillsText = deviceId
          ? skillsWithIdentity.split("${DEVICE_ID}").join(deviceId)
          : skillsWithIdentity;
        const systemAll = [systemPrompt, skillsText].filter(Boolean).join("\n\n");
        if (systemAll) promptParams.system = systemAll;

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
      const reasonParts = new Map<string, string>();
      // opencode mirrors generation on two streams (legacy message.part.* and
      // session.next.*). Each channel renders ONE source only, so mirrored
      // content can never double up, and reasoning can never reach the text
      // channel (message.part.delta.field is a *property* name — always
      // "text" — not the part type, so it must never be used to classify).
      const nextTextParts = new Map<string, string>();
      const nextReasonParts = new Map<string, string>();
      let textSrc: "part" | "next" | null = null;
      let reasonSrc: "part" | "next" | null = null;
      const partKinds = new Map<string, "text" | "reasoning">();
      const assistantIds = new Set<string>();
      let todos: any[] = [];
      let busy = false;
      let activityTimer: ReturnType<typeof setTimeout> | null = null;
      let activityDirty = false;
      let textTimer: ReturnType<typeof setTimeout> | null = null;
      let textDirty = false;
      let reasonTimer: ReturnType<typeof setTimeout> | null = null;
      let reasonDirty = false;

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
        const map = textSrc === "next" ? nextTextParts : textParts;
        send("delta", { text: [...map.values()].join("") });
      };
      const markText = () => {
        textDirty = true;
        if (!textTimer) textTimer = setTimeout(() => { textTimer = null; if (textDirty) flushText(); }, 100);
      };
      const flushReason = () => {
        if (!reasonDirty) return;
        reasonDirty = false;
        const map = reasonSrc === "next" ? nextReasonParts : reasonParts;
        send("reason", { text: [...map.values()].join("") });
      };
      const markReason = () => {
        reasonDirty = true;
        if (!reasonTimer) reasonTimer = setTimeout(() => { reasonTimer = null; if (reasonDirty) flushReason(); }, 250);
      };

      // First contributor claims its channel; the mirrored stream is ignored.
      const addPartText = (key: string, text: string) => {
        if (textSrc === "next") return;
        textSrc = "part";
        const cur = textParts.get(key) || "";
        if (text.length >= cur.length) textParts.set(key, text);
        markText();
      };
      const addPartReason = (key: string, text: string) => {
        if (reasonSrc === "next") return;
        reasonSrc = "part";
        const cur = reasonParts.get(key) || "";
        if (text.length >= cur.length) reasonParts.set(key, text);
        markReason();
      };
      const addNextText = (key: string, delta: string) => {
        if (textSrc === "part") return;
        textSrc = "next";
        nextTextParts.set(key, (nextTextParts.get(key) || "") + delta);
        markText();
      };
      const addNextReason = (key: string, delta: string) => {
        if (reasonSrc === "part") return;
        reasonSrc = "next";
        nextReasonParts.set(key, (nextReasonParts.get(key) || "") + delta);
        markReason();
      };

      // Failover/recovery restarts: drop partial state from the failed attempt.
      prep.onAttempt = () => {
        steps.clear();
        textParts.clear();
        reasonParts.clear();
        nextTextParts.clear();
        nextReasonParts.clear();
        textSrc = null;
        reasonSrc = null;
        busy = true;
        markActivity();
        markText();
        markReason();
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
          // incremental text/reasoning (legacy stream)
          if (
            typeof props.delta === "string" && props.delta &&
            (!props.field || props.field === "text" || props.field === "reasoning") &&
            props.messageID && assistantIds.has(props.messageID)
          ) {
            const key = props.partID || props.messageID;
            // Classify by part type (from message.part.updated) ONLY — the
            // `field` property is just the part's property name ("text").
            const kind = partKinds.get(key) || null;
            // Unknown kind → wait for message.part.updated to classify it;
            // authoritative part text arrives there anyway.
            if (kind === null) return;
            if (kind === "reasoning") {
              addPartReason(key, (reasonParts.get(key) || "") + props.delta);
            } else {
              addPartText(key, (textParts.get(key) || "") + props.delta);
            }
          }
        } else if (type === "session.next.reasoning.delta") {
          if (typeof props.delta === "string" && props.delta && props.sessionID) {
            addNextReason(props.reasoningID || props.assistantMessageID || "next-reason", props.delta);
          }
        } else if (type === "session.next.text.delta") {
          if (typeof props.delta === "string" && props.delta && props.sessionID) {
            addNextText(props.textID || props.assistantMessageID || "next", props.delta);
          }
        } else if (type === "message.part.updated") {
          const part = props.part;
          if (!part) return;
          if (part.type === "text" && !part.synthetic && typeof part.text === "string" && part.text && part.messageID) {
            partKinds.set(part.id, "text");
            if (assistantIds.has(part.messageID)) addPartText(part.id, part.text);
          } else if (part.type === "reasoning" && typeof part.text === "string" && part.text && part.messageID) {
            partKinds.set(part.id, "reasoning");
            if (assistantIds.has(part.messageID)) addPartReason(part.id, part.text);
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
          flushReason();
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
        } finally {
          if (activityTimer) clearTimeout(activityTimer);
          if (textTimer) clearTimeout(textTimer);
          if (reasonTimer) clearTimeout(reasonTimer);
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
