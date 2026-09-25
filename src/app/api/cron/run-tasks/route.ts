import { NextRequest, NextResponse } from "next/server";
import { runDueTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel cron invokes this daily (Hobby plan: once/day per job).
// Also callable internally with the same bearer secret.
export async function GET(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET || "founda-internal";
    const auth = request.headers.get("authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const result = await runDueTasks();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
