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
  CodeIcon, BarChartIcon, ClockIcon, LockIcon, GithubIcon,
} from "@/components/icons";

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
    <div className="min-h-screen text-white relative overflow-hidden bg-[#030712]">
      {/* Background gradient orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      {/* Grid pattern overlay */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* ── Navigation ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? "glass-strong py-2" : "py-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <Logo size={scrolled ? 28 : 36} />
            </div>
            <span
              className={`font-semibold tracking-tight transition-all duration-300 ${
                scrolled ? "text-base" : "text-lg"
              }`}
            >
              Founda CRM
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">
              Features
            </a>
            <a href="#agents" className="text-sm text-gray-400 hover:text-white transition-colors">
              Agents
            </a>
            <a href="#install" className="text-sm text-gray-400 hover:text-white transition-colors">
              Install
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
              className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
              <GithubIcon size={16} />
              GitHub
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="glass-btn px-4 py-2 rounded-xl text-sm text-gray-300 hover:text-white hidden sm:block">
              Sign In
            </Link>
            <Link href="/register" className="glass-btn-primary px-4 py-2 rounded-xl text-sm font-medium text-white">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-40 pb-24 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2.5 px-5 py-2 glass rounded-full text-sm text-indigo-300 mb-10 animate-fade-up">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          Powered by opencode — Free agents, no API keys
          <ArrowRightIcon size={14} />
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight mb-8 animate-fade-up stagger-1">
          Your AI workspace,
          <br />
          <span className="gradient-text">never forgets.</span>
        </h1>

        <p className="text-gray-400 text-lg sm:text-xl max-w-3xl mx-auto mb-12 leading-relaxed animate-fade-up stagger-2">
          A ChatGPT-style persistent interface for opencode agents. Voice input,
          image upload, session export, MCP tools, usage tracking — installable
          as an app on any device.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 animate-fade-up stagger-3">
          <Link
            href="/register"
            className="glass-btn-primary px-8 py-4 rounded-2xl font-semibold text-white text-lg w-full sm:w-auto group flex items-center justify-center gap-2"
          >
            Start Free
            <ArrowRightIcon size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <button
            onClick={handleGuest}
            className="glass-btn px-8 py-4 rounded-2xl font-medium text-gray-300 text-lg w-full sm:w-auto hover:text-white flex items-center justify-center gap-2"
          >
            <GhostIcon size={18} />
            Try Without Account
          </button>
        </div>

        <p className="text-xs text-gray-600 animate-fade-up stagger-4">
          Guest mode available — no signup required. Sessions persist only when signed in.
        </p>

        {/* Hero mockup */}
        <div className="mt-16 relative animate-fade-up stagger-5">
          <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 via-purple-500/10 to-cyan-500/20 rounded-3xl blur-2xl" />
          <div className="relative glass-card !rounded-2xl overflow-hidden text-left">
            {/* Mockup header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
              <div className="h-3 w-3 rounded-full bg-red-500/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
              <div className="ml-3 text-xs text-gray-500">Founda CRM — Dashboard</div>
            </div>
            {/* Mockup content */}
            <div className="p-6 grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-3">
                <div className="glass rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold">B</div>
                    <div className="text-sm text-white">Build Agent</div>
                    <div className="ml-auto text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">FREE</div>
                  </div>
                  <div className="text-sm text-gray-400 leading-relaxed">
                    Analyzing your codebase structure...
                  </div>
                </div>
                <div className="glass rounded-xl p-4 flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white">Y</div>
                  <div className="text-sm text-gray-300">Refactor the auth module and add tests</div>
                </div>
                <div className="flex items-center gap-2 px-4">
                  <div className="flex-1 glass-input rounded-xl px-4 py-2.5 text-sm text-gray-500">
                    Message Build...
                  </div>
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <PlayIcon size={14} className="text-white" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="glass rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-2">Daily Usage</div>
                  <div className="text-2xl font-bold text-indigo-400">12/50</div>
                  <div className="h-1.5 bg-gray-800 rounded-full mt-2 overflow-hidden">
                    <div className="h-full w-1/4 bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full" />
                  </div>
                </div>
                <div className="glass rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-2">Reset In</div>
                  <div className="text-lg font-mono text-white">07:42:18</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social proof strip ── */}
      <section className="relative z-10 border-y border-white/5 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-gray-600 text-sm">
          <div className="flex items-center gap-2">
            <ServerIcon size={16} />
            <span>opencode SDK</span>
          </div>
          <div className="flex items-center gap-2">
            <DatabaseIcon size={16} />
            <span>Supabase Auth & DB</span>
          </div>
          <div className="flex items-center gap-2">
            <GithubIcon size={16} />
            <span>GitHub Sync</span>
          </div>
          <div className="flex items-center gap-2">
            <GlobeIcon size={16} />
            <span>Vercel Deploy</span>
          </div>
          <div className="flex items-center gap-2">
            <SmartphoneIcon size={16} />
            <span>Android & iOS (Capacitor)</span>
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 glass rounded-full text-sm text-indigo-300 mb-4">
            <SparklesIcon size={14} />
            Features
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Everything you need.
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            A complete workspace for managing AI agents — from creation to persistent memory.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              icon: <ChatIcon size={24} />,
              title: "ChatGPT-Style Interface",
              desc: "Voice input, image upload, model picker, regenerate, copy — the chat experience you expect.",
              color: "from-indigo-500 to-purple-500",
            },
            {
              icon: <BotIcon size={24} />,
              title: "Free opencode Agents",
              desc: "Build, Plan, General, Explore — built into opencode. No API keys, no payment, no limits.",
              color: "from-emerald-500 to-cyan-500",
            },
            {
              icon: <ZapIcon size={24} />,
              title: "Usage Dashboard",
              desc: "Real-time token counter, daily message limits, countdown timer, and session statistics.",
              color: "from-yellow-500 to-orange-500",
            },
            {
              icon: <GhostIcon size={24} />,
              title: "Guest Mode",
              desc: "Start chatting instantly without an account. Nothing stored. Upgrade anytime to persist.",
              color: "from-purple-500 to-pink-500",
            },
            {
              icon: <RefreshIcon size={24} />,
              title: "Export / Import",
              desc: "Download session JSON at any time. Import to upgrade, migrate, or restore. Never lose context.",
              color: "from-cyan-500 to-blue-500",
            },
            {
              icon: <WrenchIcon size={24} />,
              title: "MCP Tools",
              desc: "Connect GitHub, filesystem, web search — agents use them automatically for real tasks.",
              color: "from-red-500 to-orange-500",
            },
            {
              icon: <DownloadIcon size={24} />,
              title: "Install as App",
              desc: "Capacitor wrapper — install as APK on Android or PWA on iOS. Works offline.",
              color: "from-indigo-500 to-cyan-500",
            },
            {
              icon: <KeyIcon size={24} />,
              title: "Bring Your Own Keys",
              desc: "Optional: connect Anthropic, OpenAI, Google, Groq for premium models alongside free agents.",
              color: "from-violet-500 to-purple-500",
            },
            {
              icon: <ShieldIcon size={24} />,
              title: "Row-Level Security",
              desc: "Supabase RLS ensures your sessions, agents, and keys are private to your account only.",
              color: "from-emerald-500 to-teal-500",
            },
          ].map((f, i) => (
            <div
              key={f.title}
              className={`glass-card p-6 animate-fade-up stagger-${(i % 6) + 1} group`}
            >
              <div
                className={`h-12 w-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}
              >
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-2 text-lg">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Free Agents section ── */}
      <section id="agents" className="relative z-10 border-y border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 glass rounded-full text-sm text-emerald-300 mb-4">
              <CheckIcon size={14} />
              No API Keys Needed
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">
              Free agents, ready to work.
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              opencode ships with powerful built-in agents. They work immediately — no configuration required.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: <WrenchIcon size={28} />,
                name: "Build",
                id: "build",
                desc: "Writes, edits, and builds code. The default coding agent for real development work.",
                color: "from-indigo-500 to-purple-500",
              },
              {
                icon: <ClipboardIcon size={28} />,
                name: "Plan",
                id: "plan",
                desc: "Read-only agent for analyzing architecture and creating implementation plans.",
                color: "from-cyan-500 to-blue-500",
              },
              {
                icon: <MessageIcon size={28} />,
                name: "General",
                id: "general",
                desc: "General-purpose assistant for questions, writing, research, and everyday tasks.",
                color: "from-emerald-500 to-teal-500",
              },
              {
                icon: <SearchIcon size={28} />,
                name: "Explore",
                id: "explore",
                desc: "Deep codebase search and discovery. Finds files, symbols, and patterns fast.",
                color: "from-orange-500 to-red-500",
              },
            ].map((agent, i) => (
              <div
                key={agent.id}
                className={`glass-card p-6 animate-fade-up stagger-${i + 1} group text-center`}
              >
                <div
                  className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${agent.color} flex items-center justify-center text-white mx-auto mb-4 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}
                >
                  {agent.icon}
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="font-semibold text-white text-lg">{agent.name}</h3>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                    FREE
                  </span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed mb-3">{agent.desc}</p>
                <code className="text-xs text-gray-600 font-mono bg-gray-800/50 rounded-lg px-3 py-1">
                  {agent.id}
                </code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 glass rounded-full text-sm text-cyan-300 mb-4">
            <LayersIcon size={14} />
            How It Works
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold mb-4">
            Three steps to get started.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-16 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-cyan-500/30" />

          {[
            {
              step: "01",
              title: "Create Account",
              desc: "Sign up free or continue as guest. Supabase handles authentication securely.",
              icon: <LockIcon size={24} />,
            },
            {
              step: "02",
              title: "Start Chatting",
              desc: "Pick a free agent, type your prompt, or use voice input. Images supported.",
              icon: <ChatIcon size={24} />,
            },
            {
              step: "03",
              title: "Sessions Persist",
              desc: "Your conversations are saved forever. Export JSON anytime for upgrades.",
              icon: <DatabaseIcon size={24} />,
            },
          ].map((s, i) => (
            <div
              key={s.step}
              className={`text-center animate-fade-up stagger-${i + 1} relative`}
            >
              <div className="h-16 w-16 rounded-2xl glass-card flex items-center justify-center text-indigo-400 mx-auto mb-6 relative z-10">
                {s.icon}
              </div>
              <div className="text-xs font-mono text-gray-600 mb-2">{s.step}</div>
              <h3 className="text-xl font-semibold text-white mb-3">{s.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed max-w-xs mx-auto">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Install section ── */}
      <section id="install" className="relative z-10 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 glass rounded-full text-sm text-purple-300 mb-4">
                <SmartphoneIcon size={14} />
                Install as App
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold mb-6">
                Use it anywhere.
              </h2>
              <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                Founda CRM runs as a web app, PWA, Android APK, or iOS app.
                Powered by Capacitor with package ID <code className="text-indigo-400 font-mono text-sm bg-indigo-500/10 px-2 py-0.5 rounded">com.hx.foundacrm</code>.
              </p>

              <div className="space-y-4">
                {[
                  { icon: <GlobeIcon size={18} />, title: "Web App", desc: "Deploy to Vercel — instant live URL" },
                  { icon: <SmartphoneIcon size={18} />, title: "Android APK", desc: "Build with Capacitor + Gradle" },
                  { icon: <CodeIcon size={18} />, title: "iOS App", desc: "Build with Xcode via Capacitor" },
                  { icon: <DownloadIcon size={18} />, title: "PWA", desc: "Install from browser — works offline" },
                ].map((item) => (
                  <div key={item.title} className="flex items-center gap-4 glass-card p-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <div className="font-medium text-white text-sm">{item.title}</div>
                      <div className="text-xs text-gray-500">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <code className="block text-xs text-gray-500 font-mono bg-gray-900 border border-gray-800 rounded-xl p-4 overflow-x-auto">
                  <span className="text-gray-600">$</span> npm run export{" "}
                  <span className="text-gray-600">&&</span> npx cap sync android{" "}
                  <span className="text-gray-600">&&</span> cd android && ./gradlew assembleDebug
                </code>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 rounded-3xl blur-2xl" />
              {/* Phone mockup */}
              <div className="relative mx-auto w-72">
                <div className="glass-card !rounded-[2.5rem] overflow-hidden border-2 border-white/10 shadow-2xl">
                  {/* Notch */}
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-24 h-5 bg-black rounded-full" />
                  </div>
                  {/* Screen content */}
                  <div className="px-4 pb-6 pt-2">
                    <div className="flex items-center justify-between mb-4">
                      <Logo size={24} />
                      <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600" />
                    </div>
                    <div className="glass rounded-xl p-3 mb-3">
                      <div className="text-xs text-gray-500 mb-1">Daily Usage</div>
                      <div className="text-xl font-bold text-white">12 / 50</div>
                      <div className="h-1.5 bg-gray-800 rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full w-1/4 bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="glass rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded bg-indigo-500/30 flex items-center justify-center">
                            <WrenchIcon size={10} className="text-indigo-400" />
                          </div>
                          <div className="text-xs text-white">Build Agent</div>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">Ready to work</div>
                      </div>
                      <div className="glass rounded-xl p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded bg-cyan-500/30 flex items-center justify-center">
                            <SearchIcon size={10} className="text-cyan-400" />
                          </div>
                          <div className="text-xs text-white">Explore Agent</div>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">Codebase search</div>
                      </div>
                    </div>
                    <div className="mt-4 glass rounded-xl px-3 py-2.5 flex items-center gap-2">
                      <div className="flex-1 text-[10px] text-gray-600">Message...</div>
                      <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <ArrowRightIcon size={10} className="text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="relative z-10 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: "4", label: "Free Agents", icon: <BotIcon size={20} /> },
            { value: "50", label: "Messages / Day", icon: <BarChartIcon size={20} /> },
            { value: "∞", label: "Session Storage", icon: <DatabaseIcon size={20} /> },
            { value: "0", label: "API Keys Required", icon: <KeyIcon size={20} /> },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="flex justify-center mb-3 text-indigo-400">{stat.icon}</div>
              <div className="text-4xl font-bold gradient-text mb-1">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="glass-card p-10 sm:p-14 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 h-60 w-60 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-60 w-60 bg-cyan-500/10 rounded-full blur-3xl" />

          <div className="relative z-10">
            <Logo size={48} />
            <h2 className="text-3xl sm:text-4xl font-bold mt-6 mb-4">
              Ready to start building?
            </h2>
            <p className="text-gray-400 text-lg mb-8 max-w-lg mx-auto">
              Create a free account for persistent sessions, or try it right now as a guest — no strings attached.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className="glass-btn-primary px-8 py-4 rounded-2xl font-semibold text-white text-lg group flex items-center justify-center gap-2"
              >
                Create Free Account
                <ArrowRightIcon size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <button
                onClick={handleGuest}
                className="glass-btn px-8 py-4 rounded-2xl text-gray-300 text-lg hover:text-white flex items-center justify-center gap-2"
              >
                <GhostIcon size={18} />
                Continue as Guest
              </button>
            </div>
            <div className="flex items-center justify-center gap-6 mt-8 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <CheckIcon size={12} className="text-emerald-400" />
                Free forever
              </div>
              <div className="flex items-center gap-1.5">
                <CheckIcon size={12} className="text-emerald-400" />
                No credit card
              </div>
              <div className="flex items-center gap-1.5">
                <CheckIcon size={12} className="text-emerald-400" />
                Open source
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <Logo size={28} />
              <span className="font-semibold text-sm">Founda CRM</span>
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-500">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#agents" className="hover:text-white transition-colors">Agents</a>
              <a href="#install" className="hover:text-white transition-colors">Install</a>
              <Link href="/login" className="hover:text-white transition-colors">Sign In</Link>
            </div>

            <div className="flex items-center gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-white transition-colors"
              >
                <GithubIcon size={18} />
              </a>
              <span className="text-xs text-gray-600">
                Powered by opencode
              </span>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/5 text-center text-xs text-gray-600">
            com.hx.foundacrm — Built with Next.js, Supabase, opencode, Capacitor
          </div>
        </div>
      </footer>
    </div>
  );
}

// Missing icon import fix
function ClipboardIcon({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}