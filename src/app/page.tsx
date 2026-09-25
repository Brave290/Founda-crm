"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import {
  Logo, ChatIcon, BotIcon, ZapIcon, GhostIcon, DownloadIcon,
  RefreshIcon, WrenchIcon, SearchIcon, MessageIcon, KeyIcon,
  GlobeIcon, DatabaseIcon, ShieldIcon, SparklesIcon, LayersIcon,
  SmartphoneIcon, ServerIcon, PlayIcon, ArrowRightIcon, CheckIcon,
  CodeIcon, BarChartIcon, LockIcon, GithubIcon, ClipboardIcon,
} from "@/components/icons";

const TILE = "h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 border border-violet-400/30 flex items-center justify-center text-violet-200";

export default function Home() {
  const { user, guest, loading, continueAsGuest } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mounted && !loading && (user || guest)) router.replace("/dashboard");
  }, [mounted, loading, user, guest]);

  const handleGuest = () => {
    continueAsGuest();
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen text-white relative overflow-hidden bg-[#0a0918]">

      {/* ── Navigation ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? "glass-strong py-2 border-b border-white/10" : "py-5"
        }`}
      >
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-semibold tracking-tight text-[15px]">Founda</span>
            <span className="text-[13px] text-zinc-500 hidden sm:inline">CRM</span>
          </Link>

          <div className="hidden md:flex items-center gap-7">
            <a href="#features" className="text-[13px] text-zinc-400 hover:text-white transition-colors">
              Features
            </a>
            <a href="#agents" className="text-[13px] text-zinc-400 hover:text-white transition-colors">
              Agents
            </a>
            <a href="#install" className="text-[13px] text-zinc-400 hover:text-white transition-colors">
              Install
            </a>
            <a href="https://github.com/Brave290/Founda-crm" target="_blank" rel="noopener noreferrer"
              className="text-[13px] text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
              <GithubIcon size={15} />
              GitHub
            </a>
          </div>

          <div className="flex items-center gap-2.5">
            <Link href="/login" className="px-3.5 py-1.5 rounded-lg text-[13px] text-zinc-300 hover:text-white hover:bg-white/5 transition-all">
              Sign in
            </Link>
            <Link href="/register" className="glass-btn-primary px-4 py-1.5 rounded-lg text-[13px]">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-36 pb-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] text-[12px] text-zinc-400 mb-8 animate-fade-up">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            Free agents, no API keys required
          </div>

          <h1 className="text-[44px] sm:text-6xl md:text-7xl font-semibold leading-[1.05] tracking-tight mb-6 animate-fade-up stagger-1">
            The workspace that
            <br />
            <span className="gradient-text">remembers everything.</span>
          </h1>

          <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl mb-10 leading-relaxed animate-fade-up stagger-2">
            A ChatGPT-style persistent interface for opencode agents. Voice input,
            image upload, session export, MCP tools, usage tracking — installable
            on any device.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-5 animate-fade-up stagger-3">
            <Link
              href="/register"
              className="glass-btn-primary px-7 py-3.5 rounded-xl text-[15px] w-full sm:w-auto flex items-center justify-center gap-2"
            >
              Start free
              <ArrowRightIcon size={16} />
            </Link>
            <button
              onClick={handleGuest}
              className="glass-btn px-7 py-3.5 rounded-xl text-[15px] text-zinc-300 hover:text-white w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <GhostIcon size={16} />
              Try without account
            </button>
          </div>

          <p className="text-xs text-zinc-600 animate-fade-up stagger-4">
            Guest mode available. Sessions persist only when signed in.
          </p>

          {/* Hero mockup */}
          <div className="mt-14 animate-fade-up stagger-5">
            <div className="glass-card !rounded-2xl overflow-hidden text-left !transform-none">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <div className="ml-3 text-[11px] text-zinc-600">founda — dashboard</div>
              </div>
              <div className="p-5 grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="h-6 w-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
                        <WrenchIcon size={12} />
                      </div>
                      <div className="text-[13px] text-white">Build agent</div>
                      <div className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">FREE</div>
                    </div>
                    <div className="text-[13px] text-zinc-500 leading-relaxed">
                      Analyzing your codebase structure…
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center gap-3">
                    <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-semibold text-white">Y</div>
                    <div className="text-[13px] text-zinc-400">Refactor the auth module and add tests</div>
                  </div>
                  <div className="flex items-center gap-2 px-2">
                    <div className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-[13px] text-zinc-600">
                      Message Build…
                    </div>
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-600/35">
                      <PlayIcon size={12} className="text-white" />
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-[11px] text-zinc-600 mb-2">Daily usage</div>
                    <div className="text-xl font-semibold text-white">12 / 1M</div>
                    <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                      <div className="h-full w-1/4 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full" />
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="text-[11px] text-zinc-600 mb-2">Resets in</div>
                    <div className="text-sm font-mono text-white">07:42:18</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <section className="relative z-10 border-y border-white/[0.06] py-7">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-zinc-600 text-[13px]">
          <div className="flex items-center gap-2"><ServerIcon size={15} /><span>opencode SDK</span></div>
          <div className="flex items-center gap-2"><DatabaseIcon size={15} /><span>Supabase</span></div>
          <div className="flex items-center gap-2"><GithubIcon size={15} /><span>GitHub sync</span></div>
          <div className="flex items-center gap-2"><GlobeIcon size={15} /><span>Vercel</span></div>
          <div className="flex items-center gap-2"><SmartphoneIcon size={15} /><span>Android &amp; iOS</span></div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-2xl mb-14">
          <div className="text-[12px] uppercase tracking-widest text-zinc-500 mb-3">Features</div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
            Everything you need.
          </h2>
          <p className="text-zinc-400 text-lg leading-relaxed">
            A complete workspace for managing AI agents — from creation to persistent memory.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.06] rounded-2xl overflow-hidden border border-white/[0.06]">
          {[
            {
              icon: <ChatIcon size={20} />,
              title: "ChatGPT-style interface",
              desc: "Voice input, image upload, model picker, regenerate, copy — the chat experience you expect.",
            },
            {
              icon: <BotIcon size={20} />,
              title: "Free opencode agents",
              desc: "Build, Plan, General, Explore — built into opencode. No API keys, no payment, no limits.",
            },
            {
              icon: <ZapIcon size={20} />,
              title: "Usage dashboard",
              desc: "Real-time token counter, daily message limits, countdown timer, and session statistics.",
            },
            {
              icon: <GhostIcon size={20} />,
              title: "Guest mode",
              desc: "Start chatting instantly without an account. Nothing stored. Upgrade anytime to persist.",
            },
            {
              icon: <RefreshIcon size={20} />,
              title: "Export / import",
              desc: "Download session JSON at any time. Import to upgrade, migrate, or restore. Never lose context.",
            },
            {
              icon: <WrenchIcon size={20} />,
              title: "MCP tools",
              desc: "Connect GitHub, filesystem, web search — agents use them automatically for real tasks.",
            },
            {
              icon: <DownloadIcon size={20} />,
              title: "Install as app",
              desc: "Capacitor wrapper — install as APK on Android or PWA on iOS. Works offline.",
            },
            {
              icon: <KeyIcon size={20} />,
              title: "Bring your own keys",
              desc: "Optional: connect Anthropic, OpenAI, Google, Groq for premium models alongside free agents.",
            },
            {
              icon: <ShieldIcon size={20} />,
              title: "Row-level security",
              desc: "Supabase RLS ensures your sessions, agents, and keys are private to your account only.",
            },
          ].map((f, i) => (
            <div
              key={f.title}
              className={`bg-white/[0.03] p-6 animate-fade-up stagger-${(i % 6) + 1} hover:bg-violet-500/[0.07] transition-colors`}
            >
              <div className={`${TILE} mb-4`}>{f.icon}</div>
              <h3 className="font-medium text-white mb-2 text-[15px]">{f.title}</h3>
              <p className="text-[13px] text-zinc-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Free agents section ── */}
      <section id="agents" className="relative z-10 border-y border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="max-w-2xl mb-14">
            <div className="text-[12px] uppercase tracking-widest text-zinc-500 mb-3">Agents</div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
              Free agents, ready to work.
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              opencode ships with powerful built-in agents. They work immediately — no configuration required.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: <WrenchIcon size={22} />, name: "Build", id: "build", desc: "Writes, edits, and builds code. The default coding agent for real development work." },
              { icon: <ClipboardIcon size={22} />, name: "Plan", id: "plan", desc: "Read-only agent for analyzing architecture and creating implementation plans." },
              { icon: <MessageIcon size={22} />, name: "General", id: "general", desc: "General-purpose assistant for questions, writing, research, and everyday tasks." },
              { icon: <SearchIcon size={22} />, name: "Explore", id: "explore", desc: "Deep codebase search and discovery. Finds files, symbols, and patterns fast." },
            ].map((agent, i) => (
              <div
                key={agent.id}
                className={`glass-card p-6 !transform-none animate-fade-up stagger-${i + 1}`}
              >
                <div className={`${TILE} mb-4 h-12 w-12`}>{agent.icon}</div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium text-white text-[15px]">{agent.name}</h3>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-medium">
                    FREE
                  </span>
                </div>
                <p className="text-[13px] text-zinc-500 leading-relaxed mb-3">{agent.desc}</p>
                <code className="text-[11px] text-zinc-600 font-mono bg-white/[0.04] border border-white/[0.06] rounded-md px-2 py-0.5">
                  {agent.id}
                </code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-2xl mb-14">
          <div className="text-[12px] uppercase tracking-widest text-zinc-500 mb-3">How it works</div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Three steps to get started.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            { step: "01", title: "Create account", desc: "Sign up free or continue as guest. Supabase handles authentication securely.", icon: <LockIcon size={20} /> },
            { step: "02", title: "Start chatting", desc: "Pick a free agent, type your prompt, or use voice input. Images supported.", icon: <ChatIcon size={20} /> },
            { step: "03", title: "Sessions persist", desc: "Your conversations are saved forever. Export JSON anytime for upgrades.", icon: <DatabaseIcon size={20} /> },
          ].map((s, i) => (
            <div key={s.step} className={`glass-card p-6 !transform-none animate-fade-up stagger-${i + 1}`}>
              <div className="flex items-center justify-between mb-5">
                <div className="h-10 w-10 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-300">
                  {s.icon}
                </div>
                <span className="text-[11px] font-mono text-zinc-600">{s.step}</span>
              </div>
              <h3 className="font-medium text-white mb-2 text-[15px]">{s.title}</h3>
              <p className="text-[13px] text-zinc-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Install section ── */}
      <section id="install" className="relative z-10 border-t border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-6xl mx-auto px-6 py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-[12px] uppercase tracking-widest text-zinc-500 mb-3">Install</div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-5">
              Use it anywhere.
            </h2>
            <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
              Founda runs as a web app, PWA, Android APK, or iOS app. Package ID{" "}
              <code className="text-white font-mono text-sm bg-white/[0.06] border border-white/10 px-1.5 py-0.5 rounded">com.hx.foundacrm</code>.
            </p>

            <div className="space-y-3">
              {[
                { icon: <GlobeIcon size={17} />, title: "Web app", desc: "Deploy to Vercel — instant live URL" },
                { icon: <SmartphoneIcon size={17} />, title: "Android APK", desc: "Build with Capacitor + Gradle" },
                { icon: <CodeIcon size={17} />, title: "iOS app", desc: "Build with Xcode via Capacitor" },
                { icon: <DownloadIcon size={17} />, title: "PWA", desc: "Install from browser — works offline" },
              ].map((item) => (
                <div key={item.title} className="flex items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                  <div className="h-9 w-9 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-zinc-300 shrink-0">
                    {item.icon}
                  </div>
                  <div>
                    <div className="font-medium text-white text-[14px]">{item.title}</div>
                    <div className="text-[12px] text-zinc-500">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <code className="block text-[12px] text-zinc-500 font-mono bg-black border border-white/10 rounded-xl p-4 overflow-x-auto">
                <span className="text-zinc-700">$</span> npm run export{" "}
                <span className="text-zinc-700">&&</span> npx cap sync android{" "}
                <span className="text-zinc-700">&&</span> cd android && ./gradlew assembleDebug
              </code>
            </div>
          </div>

          <div className="relative hidden lg:block">
            {/* Phone mockup */}
            <div className="relative mx-auto w-72">
              <div className="rounded-[2.25rem] overflow-hidden border-2 border-white/10 bg-[#0c0c0e] shadow-2xl">
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-20 h-4 bg-black rounded-full" />
                </div>
                <div className="px-4 pb-6 pt-2">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold text-[13px] text-white">Founda</span>
                    <div className="h-5 w-5 rounded-md bg-white/10" />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 mb-3">
                    <div className="text-[10px] text-zinc-600 mb-1">Daily usage</div>
                    <div className="text-lg font-semibold text-white">12 / 1M</div>
                    <div className="h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full w-1/4 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-white/10 flex items-center justify-center">
                          <WrenchIcon size={9} className="text-zinc-400" />
                        </div>
                        <div className="text-[11px] text-white">Build agent</div>
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-1">Ready to work</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded bg-white/10 flex items-center justify-center">
                          <SearchIcon size={9} className="text-zinc-400" />
                        </div>
                        <div className="text-[11px] text-white">Explore agent</div>
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-1">Codebase search</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 flex items-center gap-2">
                    <div className="flex-1 text-[10px] text-zinc-600">Message…</div>
                    <div className="h-5 w-5 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                      <ArrowRightIcon size={10} className="text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="relative z-10 border-y border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-14 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: "4", label: "Free agents", icon: <BotIcon size={18} /> },
            { value: "1M", label: "Messages / day", icon: <BarChartIcon size={18} /> },
            { value: "∞", label: "Session storage", icon: <DatabaseIcon size={18} /> },
            { value: "0", label: "API keys required", icon: <KeyIcon size={18} /> },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="flex justify-center mb-3 text-violet-400">{stat.icon}</div>
              <div className="text-3xl font-semibold tracking-tight text-white mb-1">{stat.value}</div>
              <div className="text-[13px] text-zinc-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-24 text-center">
        <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-b from-violet-500/[0.1] to-fuchsia-500/[0.04] p-10 sm:p-14 backdrop-blur-xl shadow-2xl shadow-violet-950/50">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
            Ready to start building?
          </h2>
          <p className="text-zinc-400 text-lg mb-8 max-w-lg mx-auto">
            Create a free account for persistent sessions, or try it right now as a guest — no strings attached.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="glass-btn-primary px-7 py-3.5 rounded-xl text-[15px] flex items-center justify-center gap-2"
            >
              Create free account
              <ArrowRightIcon size={16} />
            </Link>
            <button
              onClick={handleGuest}
              className="glass-btn px-7 py-3.5 rounded-xl text-[15px] text-zinc-300 hover:text-white flex items-center justify-center gap-2"
            >
              <GhostIcon size={16} />
              Continue as guest
            </button>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-[12px] text-zinc-600">
            <div className="flex items-center gap-1.5"><CheckIcon size={12} className="text-zinc-400" />Free forever</div>
            <div className="flex items-center gap-1.5"><CheckIcon size={12} className="text-zinc-400" />No credit card</div>
            <div className="flex items-center gap-1.5"><CheckIcon size={12} className="text-zinc-400" />Open source</div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/[0.06] py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[14px] text-white">Founda</span>
            <span className="text-[12px] text-zinc-600">CRM</span>
          </div>

          <div className="flex items-center gap-6 text-[13px] text-zinc-500">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#agents" className="hover:text-white transition-colors">Agents</a>
            <a href="#install" className="hover:text-white transition-colors">Install</a>
            <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
          </div>

          <div className="flex items-center gap-4">
            <a href="https://github.com/Brave290/Founda-crm" target="_blank" rel="noopener noreferrer"
              className="text-zinc-600 hover:text-white transition-colors">
              <GithubIcon size={17} />
            </a>
            <span className="text-[12px] text-zinc-600">Powered by opencode</span>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.06] text-center text-[12px] text-zinc-700">
          com.hx.foundacrm — Next.js, Supabase, opencode, Capacitor
        </div>
      </footer>
    </div>
  );
}
