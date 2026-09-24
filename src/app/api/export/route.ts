import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { action, userId, sessionId, exportData } = await request.json();

    switch (action) {
      case "export": {
        const { data, error } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .eq("user_id", userId)
          .single();

        if (error || !data) {
          return NextResponse.json(
            { error: "Session not found" },
            { status: 404 }
          );
        }

        const exportObj = {
          version: data.version || 1,
          title: data.title,
          agent_name: data.agent_name,
          model: data.model,
          system_prompt: data.system_prompt,
          state: data.state,
          message_count: data.message_count,
          tags: data.tags,
          exported_at: new Date().toISOString(),
          source: "founda-crm",
        };

        // Save export history
        await supabase.from("session_exports").insert({
          session_id: sessionId,
          user_id: userId,
          version: (data.version || 1) + 1,
          export_data: exportObj,
          format: "json",
        });

        // Bump version
        await supabase
          .from("sessions")
          .update({ version: (data.version || 1) + 1 })
          .eq("id", sessionId);

        return NextResponse.json({ export: exportObj });
      }

      case "import": {
        const { data: session, error: sessErr } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .eq("user_id", userId)
          .single();

        if (sessErr || !session) {
          return NextResponse.json(
            { error: "Session not found" },
            { status: 404 }
          );
        }

        const parsed = typeof exportData === "string" ? JSON.parse(exportData) : exportData;

        const { error } = await supabase
          .from("sessions")
          .update({
            state: parsed.state || session.state,
            message_count: parsed.state?.messages?.length || 0,
            version: (session.version || 1) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          messageCount: parsed.state?.messages?.length || 0,
        });
      }

      case "import_as_new": {
        const parsed =
          typeof exportData === "string" ? JSON.parse(exportData) : exportData;

        const { data: newSession, error } = await supabase
          .from("sessions")
          .insert({
            user_id: userId,
            title: parsed.title || "Imported Session",
            agent_name: parsed.agent_name || "default",
            model: parsed.model || "anthropic/claude-sonnet-4",
            system_prompt: parsed.system_prompt || null,
            state: parsed.state || { messages: [] },
            message_count: parsed.state?.messages?.length || 0,
            tags: parsed.tags || [],
            version: parsed.version || 1,
          })
          .select()
          .single();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ session: newSession });
      }

      case "list_exports": {
        const { data, error } = await supabase
          .from("session_exports")
          .select("id, version, created_at, format, notes")
          .eq("session_id", sessionId)
          .eq("user_id", userId)
          .order("version", { ascending: false });

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ exports: data });
      }

      case "restore_version": {
        const { data: versionData, error: verErr } = await supabase
          .from("session_exports")
          .select("export_data")
          .eq("id", sessionId)
          .single();

        // Note: here sessionId is actually the export ID
        if (verErr || !versionData) {
          return NextResponse.json(
            { error: "Export not found" },
            { status: 404 }
          );
        }

        return NextResponse.json({ export: versionData.export_data });
      }

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 }
    );
  }
}