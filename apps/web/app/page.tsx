"use client";

import Link from "next/link";
import { HelpChatWidget } from "./components/HelpChatWidget";

export default function LandingPage() {
  return (
    <div
      className="min-h-screen bg-white text-slate-900 antialiased"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* ── Top Nav ── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-md shadow-violet-200">
              <BotMark className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">
              ChatBot AI
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-9 text-[15px] font-semibold text-slate-700">
            <NavLink label="Product" hasCaret />
            <NavLink label="Features" />
            <NavLink label="Integrations" />
            <NavLink label="Pricing" />
            <NavLink label="Resources" hasCaret />
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-[15px] font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-[14px] font-bold shadow-lg shadow-violet-300/40 transition-all active:scale-95"
            >
              Start for Free
              <span className="text-base leading-none">→</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* soft gradient backdrop */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-pink-50" />
        <div className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] bg-violet-200/40 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 w-[520px] h-[520px] bg-pink-200/40 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-14 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left copy */}
          <div className="lg:col-span-4 space-y-7 pt-6">
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-extrabold tracking-[0.12em] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-600" />
              AI Sales &amp; Support Agent
            </span>

            <h1 className="text-[56px] leading-[1.05] font-extrabold tracking-tight text-slate-900">
              Your 24/7
              <br />
              AI Sales &amp;
              <br />
              <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
                Support Agent
              </span>
            </h1>

            <p className="text-[17px] leading-relaxed text-slate-600 max-w-md">
              Engage visitors, capture leads, book meetings, and handoff to your team — all in one AI platform.
            </p>

            <ul className="grid grid-cols-2 gap-x-6 gap-y-3 max-w-md text-[15px] text-slate-700">
              {[
                "Trained on your data",
                "No coding required",
                "Works with your tools",
                "Automate & scale",
                "Human handoff",
                "Drive more revenue",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <CheckBadge />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 pt-2">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white text-[15px] font-bold shadow-xl shadow-violet-300/50 transition-all active:scale-95"
              >
                Start for Free
              </Link>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white border border-slate-200 text-slate-800 text-[15px] font-bold hover:border-slate-300 transition-all active:scale-95"
              >
                <PlayIcon /> Watch Demo
              </button>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <div className="flex -space-x-2">
                {[
                  "https://i.pravatar.cc/64?img=47",
                  "https://i.pravatar.cc/64?img=32",
                  "https://i.pravatar.cc/64?img=12",
                  "https://i.pravatar.cc/64?img=68",
                ].map((src) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className="w-8 h-8 rounded-full border-2 border-white object-cover"
                  />
                ))}
              </div>
              <p className="text-[13px] text-slate-600 font-medium">
                Join 1,000+ businesses growing with{" "}
                <span className="font-bold text-slate-900">ChatBot AI</span>
              </p>
            </div>
          </div>

          {/* Center chat mockup */}
          <div className="lg:col-span-4 relative">
            <ChatMockup />
          </div>

          {/* Right stat cards */}
          <div className="lg:col-span-4 space-y-4 pt-2">
            <StatCard
              icon={<UsersIcon />}
              iconBg="bg-violet-100"
              iconColor="text-violet-600"
              label="Leads Captured"
              value="1,248"
              delta="40%"
              chart={<SparkLine color="#8b5cf6" />}
            />
            <StatCard
              icon={<CalendarIcon />}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              label="Meetings Booked"
              value="25"
              delta="32%"
              chart={<SparkLine color="#3b82f6" variant="b" />}
            />
            <StatCard
              icon={<DollarIcon />}
              iconBg="bg-orange-100"
              iconColor="text-orange-600"
              label="Revenue Influenced"
              value="$42,300"
              delta="28%"
              chart={<SparkLine color="#f97316" variant="c" />}
            />
            <StatCard
              icon={<ChatIcon />}
              iconBg="bg-teal-100"
              iconColor="text-teal-600"
              label="Conversations"
              value="3,672"
              delta="25%"
              chart={<BarSpark color="#14b8a6" />}
            />
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 pb-16">
          <div className="bg-white rounded-2xl shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)] border border-slate-100 px-8 py-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {[
              { icon: <StatClockIcon />, value: "5 Min", label: "Setup Time" },
              { icon: <StatBoltIcon />, value: "<100ms", label: "AI Response Time" },
              { icon: <StatTargetIcon />, value: "3x", label: "More Qualified Leads" },
              { icon: <StatHeadsetIcon />, value: "60%", label: "Support Tickets Automated" },
              { icon: <StatGlobeIcon />, value: "24/7", label: "Instant Engagement" },
              { icon: <StatShieldIcon />, value: "Enterprise", label: "Grade Security" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3.5">
                <div className="flex-shrink-0">{s.icon}</div>
                <div>
                  <div className="text-[19px] font-extrabold text-slate-900 leading-tight tracking-tight">
                    {s.value}
                  </div>
                  <div className="text-[12px] text-slate-500 font-medium leading-tight mt-0.5">
                    {s.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section id="features" className="py-20 px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              Everything You Need to Engage &amp; Convert
            </h2>
            <p className="text-slate-500 text-[14px]">
              Powerful features built to boost support, sales and revenue.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <CompactCard
              iconBg="bg-violet-100"
              icon={<RobotIcon className="w-7 h-7 text-violet-600" />}
              title="AI-Powered Conversations"
              desc="Trained on your docs, FAQs, and website content to deliver accurate answers using leading LLMs."
            >
              <div className="flex flex-wrap gap-1 mt-3">
                {[
                  ["Claude", "bg-orange-50 text-orange-700"],
                  ["GPT-4o", "bg-emerald-50 text-emerald-700"],
                  ["Gemini", "bg-blue-50 text-blue-700"],
                  ["RAG", "bg-violet-50 text-violet-700"],
                ].map(([t, c]) => (
                  <span key={t} className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c}`}>
                    {t}
                  </span>
                ))}
              </div>
            </CompactCard>

            <CompactCard
              iconBg="bg-emerald-100"
              icon={<UsersIcon className="w-7 h-7 text-emerald-600" />}
              title="Capture & Qualify Leads"
              desc="Smart forms, custom questions and AI extraction turn conversations into high-quality leads."
            >
              <div className="mt-3 space-y-1">
                <div className="h-5 rounded bg-white border border-slate-200 flex items-center px-1.5 text-[8px] text-slate-400">Name</div>
                <div className="h-5 rounded bg-white border border-slate-200 flex items-center px-1.5 text-[8px] text-slate-400">Email</div>
                <div className="h-5 rounded bg-white border border-slate-200 flex items-center px-1.5 text-[8px] text-slate-400">Company</div>
                <div className="h-5 rounded bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold">
                  Capture Lead
                </div>
                <div className="flex -space-x-1.5 pt-1">
                  {["https://i.pravatar.cc/40?img=21", "https://i.pravatar.cc/40?img=15", "https://i.pravatar.cc/40?img=8"].map((s) => (
                    <img key={s} src={s} alt="" className="w-4 h-4 rounded-full border border-white object-cover" />
                  ))}
                </div>
              </div>
            </CompactCard>

            <CompactCard
              iconBg="bg-orange-100"
              icon={<CalendarCheckIcon className="w-7 h-7 text-orange-600" />}
              title="Book Meetings Instantly"
              desc="Integrate Calendly and let visitors book meetings without back-and-forth emails."
            >
              <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-[10px] font-bold">
                <span className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center text-white text-[7px] font-black">C</span>
                Calendly
              </div>
            </CompactCard>

            <CompactCard
              iconBg="bg-blue-100"
              icon={<AgentHeadsetIcon className="w-7 h-7 text-blue-600" />}
              title="Human Handoff"
              desc="Seamlessly transfer to your team with full conversation history and context."
            >
              <div className="mt-3 bg-slate-50 rounded-lg p-2 text-[9px]">
                <div className="text-slate-400 font-semibold">Transferred to</div>
                <div className="flex items-center gap-1.5 mt-1">
                  <img src="https://i.pravatar.cc/40?img=44" alt="" className="w-5 h-5 rounded-full object-cover" />
                  <div>
                    <div className="font-bold text-slate-800 text-[10px]">Sarah (Agent)</div>
                    <div className="text-emerald-600 flex items-center gap-1 text-[8px]">
                      <span className="w-1 h-1 rounded-full bg-emerald-500" /> Online
                    </div>
                  </div>
                </div>
              </div>
            </CompactCard>

            <CompactCard
              iconBg="bg-amber-100"
              icon={<RingingBellIcon className="w-7 h-7 text-amber-500" />}
              title="Automation & Alerts"
              desc="Notifications via Slack, WhatsApp, Email and more. Escalate high-intent leads automatically."
            >
              <div className="mt-3 flex items-center gap-1.5">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-slate-600" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.527 2.527 0 0 1 2.521 2.521 2.527 2.527 0 0 1-2.521 2.521H2.522A2.527 2.527 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" /></svg>
                </span>
                <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24z" /></svg>
                </span>
                <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>
                </span>
                <span className="text-[9px] text-slate-500 font-semibold">+ more</span>
              </div>
            </CompactCard>

            <CompactCard
              iconBg="bg-pink-100"
              icon={<GrowthChartIcon className="w-7 h-7 text-pink-600" />}
              title="Analytics That Drive Growth"
              desc="Track conversions, goals, engagement and revenue impact in real time."
            >
              <div className="mt-3 bg-slate-50 rounded-lg p-2">
                <div className="flex items-center justify-between text-[8px]">
                  <span className="text-slate-500 font-semibold">Goal Completions</span>
                  <span className="text-emerald-600 font-bold">↑ 35%</span>
                </div>
                <div className="text-[13px] font-extrabold text-slate-800 mt-0.5">1,248</div>
                <div className="-mx-0.5"><BarSpark color="#ec4899" tiny /></div>
              </div>
            </CompactCard>
          </div>

          {/* Logos */}
          <div className="mt-16 text-center space-y-6">
            <p className="text-[14px] font-bold text-slate-700">Works with Your Favorite Tools</p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5 text-slate-500">
              {[
                "OpenAI",
                "Claude",
                "Gemini",
                "Slack",
                "WhatsApp",
                "Zapier",
                "Calendly",
                "Stripe",
                "Razorpay",
              ].map((b) => (
                <span key={b} className="text-[15px] font-bold tracking-tight">
                  {b}
                </span>
              ))}
              <span className="text-[14px] font-semibold text-violet-600">+ More</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-14 bg-slate-50 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
                <BotMark className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-extrabold tracking-tight">ChatBot AI</span>
            </div>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
              Your 24/7 AI sales &amp; support agent. Engage visitors, capture leads, and convert.
            </p>
          </div>
          <div className="flex md:justify-end gap-10 text-sm">
            <div className="space-y-2">
              <div className="font-bold text-slate-800">Product</div>
              <Link href="#features" className="block text-slate-500 hover:text-violet-600">Features</Link>
              <Link href="#" className="block text-slate-500 hover:text-violet-600">Pricing</Link>
              <Link href="/login" className="block text-slate-500 hover:text-violet-600">Login</Link>
            </div>
            <div className="space-y-2">
              <div className="font-bold text-slate-800">Legal</div>
              <Link href="#" className="block text-slate-500 hover:text-violet-600">Privacy</Link>
              <Link href="#" className="block text-slate-500 hover:text-violet-600">Terms</Link>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 lg:px-8 mt-10 pt-6 border-t border-slate-200 text-xs text-slate-500">
          © {new Date().getFullYear()} ChatBot AI. All rights reserved.
        </div>
      </footer>

      <HelpChatWidget side="right" />
    </div>
  );
}

/* ───────── Sub-components ───────── */

function NavLink({ label, hasCaret = false }: { label: string; hasCaret?: boolean }) {
  return (
    <a
      href="#"
      className="inline-flex items-center gap-1 hover:text-violet-600 transition-colors"
    >
      {label}
      {hasCaret && (
        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
          <path d="M5.5 7.5L10 12l4.5-4.5z" />
        </svg>
      )}
    </a>
  );
}

function CheckBadge() {
  return (
    <span className="inline-flex w-5 h-5 rounded-full bg-violet-100 items-center justify-center flex-shrink-0">
      <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
        <path d="M5 10.5l3 3 7-7" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function PlayIcon() {
  return (
    <span className="inline-flex w-5 h-5 rounded-full bg-violet-600 items-center justify-center">
      <svg width="9" height="9" viewBox="0 0 12 12" fill="white">
        <path d="M3 2.5v7l6-3.5z" />
      </svg>
    </span>
  );
}

function ChatMockup() {
  const suggestions = [
    "How can ChatBot AI help me?",
    "What integrations does ChatBot AI offer?",
    "Is there a free plan?",
    "Can I see a demo?",
  ];
  return (
    <div className="mx-auto max-w-[400px] rounded-[40px] bg-slate-900 p-1.5 shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)]">
      <div className="flex h-[640px] flex-col overflow-hidden rounded-[36px] bg-white">
        {/* Header */}
        <div className="flex items-center gap-3 bg-violet-600 px-4 py-3.5 text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-violet-600 font-extrabold">
            A
          </div>
          <div className="flex-1 text-[15px] font-semibold leading-none">
            Assistant
          </div>
          <button className="text-white/80 hover:text-white" aria-label="More">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>
          <button className="text-white/80 hover:text-white" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
          <div className="self-start max-w-[80%] rounded-2xl bg-slate-100 px-3.5 py-2 text-[13px] text-slate-800">
            Hi! How can I help you today?
          </div>

          <div className="mt-auto flex flex-col items-end gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[12.5px] text-slate-700 hover:border-violet-300 hover:text-violet-700 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Powered by */}
        <div className="flex justify-center pb-1.5">
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] text-slate-500">
            Powered by <span className="font-semibold text-slate-700">ChatBot AI</span>
          </span>
        </div>

        {/* Composer */}
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 rounded-full bg-slate-100 pl-4 pr-1.5 py-1.5">
            <input
              type="text"
              placeholder="Ask me anything..."
              className="flex-1 bg-transparent text-[13px] outline-none placeholder-slate-400"
            />
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-700"
              aria-label="Send"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  delta,
  chart,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  delta: string;
  chart: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${iconBg} ${iconColor} flex items-center justify-center flex-shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-slate-500">{label}</span>
          <span className="text-[11px] font-bold text-emerald-600">↑ {delta}</span>
        </div>
        <div className="text-[22px] font-extrabold text-slate-900 leading-tight mt-0.5">
          {value}
        </div>
        <div className="text-[10px] text-slate-400">vs last 30 days</div>
      </div>
      <div className="w-24 h-12 flex-shrink-0">{chart}</div>
    </div>
  );
}

function CompactCard({
  iconBg,
  icon,
  title,
  desc,
  children,
}: {
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-6px_rgba(15,23,42,0.06)] p-4 hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-200 transition-all duration-300 flex flex-col">
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <h3 className="text-[13px] font-extrabold text-slate-900 leading-tight mb-1.5">
            {title}
          </h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">{desc}</p>
        </div>
      </div>
      {children && <div className="mt-auto pt-3">{children}</div>}
    </div>
  );
}

function FeatureCard({
  iconBg,
  icon,
  title,
  desc,
  tag,
  children,
}: {
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  tag?: { label: string; className: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_16px_-6px_rgba(15,23,42,0.08)] p-7 hover:shadow-xl hover:-translate-y-1 hover:border-slate-200 transition-all duration-300">
      <div className="flex items-start justify-between mb-5">
        <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
        {tag && (
          <span className={`px-3 py-1 rounded-full text-[11px] font-bold ${tag.className}`}>
            {tag.label}
          </span>
        )}
      </div>
      <h3 className="text-[19px] font-extrabold text-slate-900 leading-snug mb-2">
        {title}
      </h3>
      <p className="text-[14px] text-slate-500 leading-relaxed">{desc}</p>
      {children}
    </div>
  );
}

/* sparklines */
function SparkLine({ color, variant = "a" }: { color: string; variant?: "a" | "b" | "c" }) {
  const paths: Record<string, string> = {
    a: "M0 36 L12 30 L24 32 L36 22 L48 24 L60 14 L72 18 L84 8 L96 12",
    b: "M0 30 L12 28 L24 22 L36 26 L48 18 L60 20 L72 12 L84 14 L96 6",
    c: "M0 32 L12 26 L24 28 L36 18 L48 22 L60 12 L72 16 L84 8 L96 4",
  };
  return (
    <svg viewBox="0 0 96 48" className="w-full h-full">
      <defs>
        <linearGradient id={`g-${color}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${paths[variant]} L96 48 L0 48 Z`} fill={`url(#g-${color})`} />
      <path d={paths[variant]} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BarSpark({ color, tiny = false }: { color: string; tiny?: boolean }) {
  const heights = [10, 14, 9, 18, 12, 22, 16, 26, 20, 30, 24, 36];
  return (
    <svg viewBox="0 0 96 48" className={`w-full ${tiny ? "h-6" : "h-full"}`}>
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 7.5 + 1}
          y={48 - h}
          width="5"
          height={h}
          rx="1.5"
          fill={color}
          opacity={0.4 + (i / heights.length) * 0.6}
        />
      ))}
    </svg>
  );
}

/* icons */
function BotMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a1 1 0 011 1v1.07A7.002 7.002 0 0119 11v3a3 3 0 01-3 3H8a3 3 0 01-3-3v-3a7.002 7.002 0 016-6.93V3a1 1 0 011-1zm-3 9a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM7 19h10v2H7v-2z" />
    </svg>
  );
}
function UsersIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="9" r="3.5" fill="currentColor" />
      <path d="M7 21c0-3.3 3.1-6 7-6s7 2.7 7 6" fill="currentColor" />
      <circle cx="6" cy="11" r="2.6" fill="currentColor" opacity="0.65" />
      <circle cx="22" cy="11" r="2.6" fill="currentColor" opacity="0.65" />
      <path d="M2 22c0-2.5 1.8-4.5 4-4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
      <path d="M26 22c0-2.5-1.8-4.5-4-4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}
function CalendarCheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none">
      <rect x="4" y="6" width="20" height="18" rx="3" fill="currentColor" opacity="0.18" />
      <rect x="4" y="6" width="20" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M4 11h20" stroke="currentColor" strokeWidth="2" />
      <path d="M9 4v4M19 4v4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9 17l3 3 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function AgentHeadsetIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="11" r="4.5" fill="currentColor" />
      <path d="M5 24c0-4.4 4-7.5 9-7.5s9 3.1 9 7.5" fill="currentColor" opacity="0.55" />
      <path d="M5 13a9 9 0 0118 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="3.5" y="13" width="3.5" height="6" rx="1.6" fill="currentColor" />
      <rect x="21" y="13" width="3.5" height="6" rx="1.6" fill="currentColor" />
    </svg>
  );
}
function RingingBellIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none">
      <path
        d="M14 4a7 7 0 00-7 7v3.5a3 3 0 01-.7 1.9L4.5 18.5a1 1 0 00.8 1.6h17.4a1 1 0 00.8-1.6l-1.8-2.1a3 3 0 01-.7-1.9V11a7 7 0 00-7-7z"
        fill="currentColor"
      />
      <path d="M11 22a3 3 0 006 0" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M2.5 8c1-1.2 2.5-2 4-2.2M25.5 8c-1-1.2-2.5-2-4-2.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
function GrowthChartIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none">
      <rect x="5" y="14" width="3.5" height="9" rx="1" fill="currentColor" opacity="0.55" />
      <rect x="11" y="10" width="3.5" height="13" rx="1" fill="currentColor" opacity="0.75" />
      <rect x="17" y="6" width="3.5" height="17" rx="1" fill="currentColor" />
      <path d="M5 11l6-4 6-2 6-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
function CalendarIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
function DollarIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M16 7H9.5a2.5 2.5 0 000 5h5a2.5 2.5 0 010 5H7" />
    </svg>
  );
}
function ChatIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7v5l3 2" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
function HeadsetIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 14v-3a9 9 0 0118 0v3M21 19a2 2 0 01-2 2h-1v-6h1a2 2 0 012 2v2zM3 19a2 2 0 002 2h1v-6H5a2 2 0 00-2 2v2z" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinejoin="round" d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    </svg>
  );
}
function RobotIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 28" fill="none">
      <path d="M14 3v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="3" r="1.4" fill="currentColor" />
      <rect x="4.5" y="8" width="19" height="14" rx="4" fill="currentColor" />
      <rect x="6.5" y="10.5" width="15" height="9" rx="2.5" fill="white" />
      <circle cx="11" cy="15" r="1.6" fill="currentColor" />
      <circle cx="17" cy="15" r="1.6" fill="currentColor" />
      <path d="M2.5 13v3M25.5 13v3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
function BellIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14V11a6 6 0 00-12 0v3a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" />
    </svg>
  );
}
function StatClockIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="14" stroke="#a78bfa" strokeWidth="2.2" opacity="0.55" />
      <path d="M18 10v8l5 3" stroke="#7c3aed" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="27" cy="9" r="5" fill="#7c3aed" />
      <path d="M24.5 9l1.7 1.6L29.5 7.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function StatBoltIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
      <path d="M20.5 3L7 20h8l-2 13 13-17h-8l2.5-13z" fill="#7c3aed" />
      <path d="M20.5 3L7 20h8l-2 13 13-17h-8l2.5-13z" fill="url(#boltgrad)" opacity="0.5" />
      <defs>
        <linearGradient id="boltgrad" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
  );
}
function StatTargetIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
      <circle cx="16" cy="20" r="12" stroke="#fb923c" strokeWidth="2.2" />
      <circle cx="16" cy="20" r="7" stroke="#f97316" strokeWidth="2.2" />
      <circle cx="16" cy="20" r="2.5" fill="#ef4444" />
      <path d="M22 14L31 5" stroke="#ef4444" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M28 4l3.5-1-1 3.5L28 4z" fill="#ef4444" />
      <path d="M22 14l4-1 1-3" stroke="#ef4444" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function StatHeadsetIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
      <path d="M6 21v-3a12 12 0 0124 0v3" stroke="url(#hsg)" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="4" y="20" width="6" height="10" rx="2.5" fill="url(#hsg)" />
      <rect x="26" y="20" width="6" height="10" rx="2.5" fill="url(#hsg)" />
      <defs>
        <linearGradient id="hsg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
    </svg>
  );
}
function StatGlobeIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="14" stroke="#7c3aed" strokeWidth="2.2" />
      <ellipse cx="18" cy="18" rx="6" ry="14" stroke="#7c3aed" strokeWidth="2.2" />
      <path d="M4 18h28" stroke="#7c3aed" strokeWidth="2.2" />
      <path d="M6 11h24M6 25h24" stroke="#a78bfa" strokeWidth="1.6" opacity="0.7" />
    </svg>
  );
}
function StatShieldIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 36 36" fill="none">
      <path
        d="M18 3l12 4.5v9c0 7.5-5.2 12-12 13.5-6.8-1.5-12-6-12-13.5v-9L18 3z"
        fill="#ede9fe"
        stroke="#7c3aed"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M12 18l4 4 8-9" stroke="#7c3aed" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Sparkle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    </svg>
  );
}
function ChartIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M6 17V9m4 8V5m4 12v-7m4 7v-4" />
    </svg>
  );
}
