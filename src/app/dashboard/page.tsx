"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The old dashboard was folded into Settings (MCP, API keys, account, usage,
// skills, schedule, data). This route now lands you straight in a new chat.
export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const { createSupabaseBrowserClient } = await import("@/lib/supabase-browser");
        const { data } = await createSupabaseBrowserClient().auth.getUser();
        router.replace(data.user ? `/sessions/${crypto.randomUUID()}` : "/login");
      } catch { router.replace("/login"); }
    })();
  }, [router]);

  return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 bg-[#0b1120]">
      <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      <div className="text-slate-500 text-sm">Opening your workspace…</div>
    </div>
  );
}
