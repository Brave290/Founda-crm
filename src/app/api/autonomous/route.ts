import { NextRequest, NextResponse } from "next/server";
import { ensureServer } from "@/lib/opencode";

export const dynamic = "force-dynamic";

// In-memory store of running autonomous tasks
const autonomousTasks = new Map<string, { task: string; repo: string; status: string; startedAt: number; log: string[] }>();

export async function POST(request: NextRequest) {
  try {
    const { action, task, repo } = await request.json();

    switch (action) {
      case "start": {
        if (!task) {
          return NextResponse.json({ error: "Task required" }, { status: 400 });
        }

        const taskId = crypto.randomUUID();
        const entry = {
          task,
          repo: repo || "",
          status: "running",
          startedAt: Date.now(),
          log: [`[${new Date().toISOString()}] Autonomous task started`],
        };
        autonomousTasks.set(taskId, entry);

        // Run the task in background — continues even if user disconnects
        runAutonomousTask(taskId, task, repo).catch((err) => {
          entry.status = "error";
          entry.log.push(`[${new Date().toISOString()}] Error: ${err.message}`);
        });

        return NextResponse.json({ taskId, status: "running" });
      }

      case "stop": {
        // Mark all running tasks as stopped
        for (const [id, entry] of autonomousTasks) {
          if (entry.status === "running") {
            entry.status = "stopped";
            entry.log.push(`[${new Date().toISOString()}] Stopped by user`);
          }
        }
        return NextResponse.json({ status: "stopped" });
      }

      case "status": {
        const tasks = Array.from(autonomousTasks.entries()).map(([id, t]) => ({
          id,
          ...t,
        }));
        return NextResponse.json({ tasks });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function runAutonomousTask(taskId: string, task: string, repo: string) {
  const entry = autonomousTasks.get(taskId);
  if (!entry) return;

  try {
    const client = await ensureServer();
    entry.log.push(`[${new Date().toISOString()}] Connecting to opencode...`);

    // Create a session for this autonomous task
    const created = await client.session.create({
      title: `Autonomous: ${task.slice(0, 60)}`,
      agent: "build",
      metadata: { autonomous: true, taskId },
    });

    const sessionID = (created as any)?.data?.id;
    if (!sessionID) throw new Error("Failed to create autonomous session");
    entry.log.push(`[${new Date().toISOString()}] Session created: ${sessionID}`);

    // Build autonomous prompt with permission-free instructions
    const autonomousPrompt = `
You are running in AUTONOMOUS MODE on a server. The user is not present.
You have FULL PERMISSION to execute all actions without asking.

Task: ${task}
${repo ? `Repository: ${repo}` : ""}

Instructions:
1. Complete the task fully without asking for permissions
2. If a repo is provided, clone/pull it, make changes, and commit them
3. Run tests to verify your work
4. If tests fail, fix them and re-run
5. Commit all changes with descriptive messages
6. Do NOT ask questions — make reasonable decisions
7. Work until the task is complete

Start now.`;

    entry.log.push(`[${new Date().toISOString()}] Sending prompt to agent...`);

    // Send the prompt — noReply: false means it processes fully
    const result = await client.session.prompt({
      sessionID,
      parts: [{ type: "text", text: autonomousPrompt }],
      agent: "build",
      tools: {
        // Enable all tools without permission checks
        bash: true,
        edit: true,
        read: true,
        write: true,
        grep: true,
        glob: true,
        webfetch: true,
      },
    });

    entry.log.push(`[${new Date().toISOString()}] Task completed`);
    entry.status = "completed";

    // If repo provided, ensure changes are committed
    if (repo) {
      try {
        await client.session.prompt({
          sessionID,
          parts: [
            {
              type: "text",
              text: "If you made any changes, commit them all now with a descriptive commit message. Push if remote is configured.",
            },
          ],
          agent: "build",
          tools: { bash: true, write: true, edit: true },
        });
        entry.log.push(`[${new Date().toISOString()}] Changes committed to repo`);
      } catch (e: any) {
        entry.log.push(`[${new Date().toISOString()}] Commit error: ${e.message}`);
      }
    }
  } catch (err: any) {
    entry.status = "error";
    entry.log.push(`[${new Date().toISOString()}] Error: ${err.message}`);
  }
}

export async function GET() {
  const tasks = Array.from(autonomousTasks.entries()).map(([id, t]) => ({
    id,
    ...t,
  }));
  return NextResponse.json({ tasks });
}