import Link from "next/link";

function MarkIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7.5l7-4 7 4v9l-7 4-7-4z" />
      <path d="M9 11.2l3 1.8 3-1.8" />
      <path d="M12 13v4.2" />
    </svg>
  );
}

export function AuthShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-4 py-10">
      {/* ambient DeepSeek-style glow + ChatGPT-clean dot grid */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 h-[560px] w-[900px] rounded-full bg-emerald-500/[0.13] blur-[140px]" />
        <div className="absolute -bottom-40 -right-32 h-[440px] w-[440px] rounded-full bg-cyan-500/[0.08] blur-[130px]" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse at 50% 28%, black, transparent 78%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 28%, black, transparent 78%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#07090f] to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-[400px] animate-scale-in">
        {/* brand */}
        <Link href="/" className="flex flex-col items-center gap-3.5 mb-7 select-none group">
          <span className="relative h-14 w-14 rounded-[18px] bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 flex items-center justify-center shadow-[0_14px_46px_-8px_rgba(16,185,129,0.55)] transition-transform group-hover:scale-105">
            <MarkIcon />
            <span className="absolute inset-0 rounded-[18px] ring-1 ring-inset ring-white/25" />
            <span className="absolute -inset-1 rounded-[22px] ring-1 ring-emerald-400/20 blur-[2px]" />
          </span>
          <span className="text-center">
            <span className="block font-semibold text-[22px] gradient-text tracking-tight">Founda CRM</span>
            <span className="block text-[12.5px] text-slate-600 mt-1">Persistent memory for every AI session</span>
          </span>
        </Link>

        {/* card */}
        <div className="rounded-[24px] border border-white/[0.09] bg-white/[0.035] p-6 sm:p-7 backdrop-blur-2xl shadow-[0_34px_90px_-28px_rgba(0,0,0,0.85)]">
          <div className="text-center mb-6">
            <h1 className="font-display text-[22px] font-semibold text-white tracking-tight">{title}</h1>
            <p className="text-slate-500 text-[13.5px] mt-1.5">{subtitle}</p>
          </div>
          {children}
        </div>

        <p className="text-center text-[11px] text-slate-700 mt-5 leading-relaxed">
          Secured with Supabase auth · Free forever · No credit card
        </p>
      </div>
    </div>
  );
}

export function AuthTabs({ active }: { active: "login" | "register" }) {
  const cls = (on: boolean) =>
    `flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
      on ? "bg-white/[0.09] text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
    }`;
  return (
    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/40 border border-white/[0.07] mb-6">
      <Link href="/login" className={cls(active === "login")}>
        Sign in
      </Link>
      <Link href="/register" className={cls(active === "register")}>
        Create account
      </Link>
    </div>
  );
}

export function AuthField({
  icon,
  ...props
}: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="relative block group">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-emerald-400 transition-colors pointer-events-none">
        {icon}
      </span>
      <input
        {...props}
        className="w-full pl-10 pr-3.5 py-3 rounded-xl bg-black/45 border border-white/[0.09] text-white text-sm placeholder-slate-600 focus:outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-500/15 hover:border-white/20 transition-all"
      />
    </label>
  );
}
