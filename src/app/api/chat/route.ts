import { NextRequest, NextResponse } from "next/server";
import { ensureServer } from "@/lib/opencode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { sessionId, prompt, agent, model, systemPrompt } =
      await request.json();

    const client = await ensureServer();
    const directory = process.env.OPENCODE_WORKSPACE || "/tmp/oc-workspace";

    // Create session if not provided
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const createParams: any = {
        title: prompt?.slice(0, 60) || "New Chat",
        directory,
      };
      if (agent) createParams.agent = agent;
      if (model) {
        const [providerID, modelID] = model.includes("/")
          ? model.split("/")
          : [model, "default"];
        createParams.model = { providerID, id: modelID };
      }
      const created: any = await client.session.create(createParams);
      targetSessionId = created?.data?.id;
      if (!targetSessionId) {
        throw new Error(
          "Failed to create opencode session: " +
            JSON.stringify(created?.error || created?.response?.status || created || "unknown")
        );
      }
    }

    // Send prompt to opencode
    const promptParams: any = {
      sessionID: targetSessionId,
      parts: [{ type: "text", text: prompt }],
    };
    if (agent) promptParams.agent = agent;
    if (model) {
      const [providerID, modelID] = model.includes("/")
        ? model.split("/")
        : [model, "default"];
      promptParams.model = { providerID, modelID };
    }
    if (systemPrompt) promptParams.system = systemPrompt;

    promptParams.directory = directory;
    const result: any = await client.session.prompt(promptParams);
    if (!result?.data && result?.error) {
      throw new Error("opencode prompt failed: " + JSON.stringify(result.error));
    }

    // Extract text from response
    const data = (result as any)?.data;
    const info = data?.info;
    if (info?.error) {
      const err: any = info.error;
      const detail = err?.data ? JSON.stringify(err.data) : JSON.stringify(err);
      throw new Error(`model error [${err?.name || "unknown"}]: ${detail}`);
    }
    let content = "";
    if (data) {
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
    }

    return NextResponse.json({
      content: content || "(empty response)",
      sessionId: targetSessionId,
      metadata: { agent: agent || "build", model: model || "default" },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "opencode error" },
      { status: 500 }
    );
  }
}