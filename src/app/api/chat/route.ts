import { NextRequest, NextResponse } from "next/server";
import { ensureServer } from "@/lib/opencode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { sessionId, prompt, agent, model, systemPrompt } =
      await request.json();

    const client = await ensureServer();

    // Create session if not provided
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const createParams: any = { title: prompt?.slice(0, 60) || "New Chat" };
      if (agent) createParams.agent = agent;
      if (model) {
        const [providerID, modelID] = model.includes("/")
          ? model.split("/")
          : [model, "default"];
        createParams.model = { providerID, modelID };
      }
      const created = await client.session.create(createParams);
      targetSessionId = (created as any)?.data?.id;
      if (!targetSessionId) {
        throw new Error("Failed to create opencode session");
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

    const result = await client.session.prompt(promptParams);

    // Extract text from response
    const data = (result as any)?.data;
    let content = "";
    if (data) {
      if (typeof data === "string") {
        content = data;
      } else if (data.text) {
        content = data.text;
      } else if (data.parts && Array.isArray(data.parts)) {
        content = data.parts
          .filter((p: any) => p.type === "text" || p.text)
          .map((p: any) => p.text || p.content || "")
          .join("\n");
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