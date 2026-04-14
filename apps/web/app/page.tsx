"use client";

import Link from "next/link";
import Image from "next/image";
import { HelpChatWidget } from "./components/HelpChatWidget";

export default function LandingPage() {
  return (
    <div className="bg-background text-on-surface" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* ── Top Nav ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-[0_4px_20px_rgba(25,28,29,0.06)]">
        <div className="max-w-7xl mx-auto px-8 flex justify-between items-center h-20">
          <div className="text-2xl font-black text-slate-900">ChatBot AI</div>
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-[#F15A24] font-bold border-b-2 border-[#F15A24] pb-1 tracking-tight">
              Features
            </a>
            <a href="#pricing" className="text-slate-600 hover:text-slate-900 transition-all duration-300 font-semibold tracking-tight">
              Pricing
            </a>
            <a href="#how-it-works" className="text-slate-600 hover:text-slate-900 transition-all duration-300 font-semibold tracking-tight">
              How It Works
            </a>
            <a href="#testimonials" className="text-slate-600 hover:text-slate-900 transition-all duration-300 font-semibold tracking-tight">
              Testimonials
            </a>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/login" className="px-6 py-2 text-slate-600 font-semibold hover:text-slate-900 active:scale-95 transition-transform">
              Login
            </Link>
            <Link href="/signup" className="px-6 py-3 bg-primary text-white rounded-full font-bold shadow-lg hover:bg-primary-container active:scale-95 transition-transform">
              Start for Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-40 pb-24 px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <span className="px-4 py-2 bg-primary-fixed text-on-primary-fixed-variant rounded-full text-sm font-bold tracking-wider uppercase inline-block">
              High-Octane Intelligence
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-on-surface leading-[1.1] tracking-tight">
              Scale Your Support with{" "}
              <span className="text-primary">High-Octane</span> Intelligence
            </h1>
            <p className="text-xl text-on-surface-variant max-w-xl leading-relaxed">
              24/7 automated engagement that thinks like your best team member. Boost
              conversion rates by 400% with the world's most responsive AI assistant.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href="/signup"
                className="px-8 py-5 bg-on-surface text-surface rounded-full text-lg font-bold shadow-xl hover:opacity-90 active:scale-95 transition-all text-center"
              >
                Start for Free
              </Link>
              <a
                href="#how-it-works"
                className="px-8 py-5 bg-surface-container-high text-on-surface rounded-full text-lg font-bold hover:bg-surface-container-highest active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">play_circle</span> View Demo
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -top-10 -left-10 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative bg-surface-container-lowest p-4 rounded-3xl shadow-2xl border border-outline-variant/20">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfHB2fxkVg_KNkfXULjX_8trWZKn5ZeMBmu6KuvrCxBq4d72RzFdiImeMMOdIp6aSfbF1fSFPIebY97nbt1WodHqZMdtF8m-gkDLHYlPUZFXtcdxhKzmXfPZS8phHHUwKmzc1Nxb1emHFE4fqQHa6XaoIaZXxnyg_SXHK-T7FKwtwQx7UBeUD4sagagpAu6FtpkeqNMgLGopTs3J4fgHnZLLAskTjNBbdWF6kNwuGx9nR-JfepL5A4GiDJgzc9OUHc0iVT6hSPl5o"
                alt="Modern workspace"
                className="rounded-2xl w-full h-auto object-cover aspect-video"
              />
              <div className="absolute -bottom-6 -right-6 bg-white p-6 rounded-2xl shadow-xl max-w-xs border border-outline-variant/10">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      bolt
                    </span>
                  </div>
                  <div className="font-bold">Real-time Lead found!</div>
                </div>
                <p className="text-sm text-on-surface-variant">
                  AI just identified a high-intent visitor from Enterprise Tech.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features / Benefits ── */}
      <section id="features" className="py-24 bg-surface-container-low px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <span className="text-primary font-bold tracking-widest uppercase text-sm">Why Choose Us</span>
            <h2 className="text-3xl md:text-5xl font-bold text-on-surface">
              Engineered for Massive Profit Growth
            </h2>
            <p className="text-on-surface-variant max-w-2xl mx-auto text-lg">
              Our high-octane intelligence doesn't just chat—it identifies leads and provides
              expert-level support to boost your bottom line.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: "schedule",
                bg: "bg-primary-fixed",
                iconColor: "text-on-primary-fixed",
                title: "24/7 Auto-Reply",
                desc: "Ensure instant responses to customer inquiries at any hour. Our AI handles the workload even when your human team is offline, capturing leads while you sleep.",
              },
              {
                icon: "verified",
                bg: "bg-secondary-fixed",
                iconColor: "text-on-secondary-fixed",
                title: "Company Intelligence",
                desc: "Equip your AI agent with deep knowledge. It provides accurate, brand-aligned information about your products and services with professional precision.",
              },
              {
                icon: "support_agent",
                bg: "bg-tertiary-fixed",
                iconColor: "text-on-tertiary-fixed",
                title: "Seamless Human Takeover",
                desc: "Complex issues? No problem. Real people can step in and take over any chat instantly, ensuring your customers always get the help they need.",
              },
              {
                icon: "history_edu",
                bg: "bg-secondary-fixed",
                iconColor: "text-on-secondary-fixed",
                title: "Full Conversation Logging",
                desc: "Every single interaction is recorded and accessible in your dashboard. Review, analyze, and optimize your strategy with full transparency.",
              },
              {
                icon: "task_alt",
                bg: "bg-primary-fixed",
                iconColor: "text-on-primary-fixed",
                title: "True Issue Resolution",
                desc: "Most bots just talk; ours solves. Provide actual answers and resolve customer problems autonomously, significantly lowering your support ticket volume.",
              },
              {
                icon: "integration_instructions",
                bg: "bg-tertiary-fixed",
                iconColor: "text-on-tertiary-fixed",
                title: "No-Code Integration",
                desc: "Connect to your website in seconds with one script tag. Deploy high-octane intelligence across your entire stack without a single line of code.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-surface-container-lowest p-10 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-500 group"
              >
                <div className={`w-16 h-16 rounded-2xl ${f.bg} mb-8 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <span className={`material-symbols-outlined ${f.iconColor} text-3xl`}>{f.icon}</span>
                </div>
                <h3 className="text-2xl font-bold mb-4">{f.title}</h3>
                <p className="text-on-surface-variant leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works / Bento ── */}
      <section id="how-it-works" className="py-24 px-8 bg-surface">
        <div className="max-w-7xl mx-auto bg-on-surface rounded-[3rem] overflow-hidden flex flex-col lg:flex-row shadow-2xl">
          <div className="flex-1 p-12 lg:p-20 space-y-8">
            <span className="text-primary font-bold tracking-widest uppercase text-sm">
              How It Works: The Profit Engine
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-surface leading-tight">
              Turn Anonymous Traffic Into Your Biggest Profit Driver
            </h2>
            <p className="text-surface/70 text-lg leading-relaxed">
              Most bots wait for a question. Ours hunts for opportunities. ChatBot AI monitors
              behavioral signals to identify visitors who are ready to buy, initiating the perfect
              conversation at the exact moment it matters most.
            </p>
            <ul className="space-y-4">
              {[
                "Upload your content — docs, FAQs, URLs — in minutes",
                "Customize color, tone, and welcome message to match your brand",
                "Paste one script tag. Works on any website, no developer needed",
              ].map((item) => (
                <li key={item} className="flex items-start gap-4 text-surface">
                  <span
                    className="material-symbols-outlined text-primary flex-shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="pt-4">
              <Link
                href="/signup"
                className="inline-block px-8 py-4 bg-primary text-white rounded-full font-bold hover:bg-primary-container transition-all"
              >
                Get Started Free
              </Link>
            </div>
          </div>
          <div className="flex-1 bg-surface-container-highest relative min-h-[400px]">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuALFi3H5ah9KLaqKI-avnz2G1pXG57ybQPK3NoZruHA6-Qt2TnxVeG0p2gAUz6DuR8J73kYaOo81o3LgVcK1gCDf1gPhtVpzx5MkCosY8twoA0GXEKvu1N3JCVv0VTFBTSU8dmq6F7Hez-NpqUpt3uUojc9Heq4jn61l9SrKiadPvXi27A8qf8s-a4P6Zj9IIPQLl9T6enIn3A2iBYkxwx5hBJA3twlTWqTOt9iJd22fI6SNBXS5xRGdY6rbnmoW4KpDBx-bxVoCPo"
              alt="Data visualization dashboard"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-primary/20 mix-blend-multiply" />
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 bg-surface-container-low px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <span className="text-primary font-bold tracking-widest uppercase text-sm">Pricing</span>
            <h2 className="text-3xl md:text-5xl font-bold text-on-surface">
              Simple, Transparent Plans
            </h2>
            <p className="text-on-surface-variant max-w-2xl mx-auto text-lg">
              Start free. Scale as you grow. No hidden fees.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: "Free",
                price: "$0",
                period: "/month",
                messages: "100 messages",
                docs: "1 document",
                highlight: false,
                cta: "Get Started",
              },
              {
                name: "Starter",
                price: "$19",
                period: "/month",
                messages: "1,000 messages",
                docs: "10 documents",
                highlight: false,
                cta: "Start Starter",
              },
              {
                name: "Growth",
                price: "$49",
                period: "/month",
                messages: "10,000 messages",
                docs: "Unlimited docs",
                highlight: true,
                cta: "Start Growth",
              },
              {
                name: "Enterprise",
                price: "$149",
                period: "/month",
                messages: "Unlimited messages",
                docs: "Unlimited docs",
                highlight: false,
                cta: "Contact Sales",
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative p-8 rounded-3xl flex flex-col gap-6 ${
                  plan.highlight
                    ? "bg-on-surface text-surface shadow-2xl scale-105"
                    : "bg-surface-container-lowest shadow-sm hover:shadow-xl"
                } transition-all duration-300`}
              >
                {plan.highlight && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1.5 bg-primary text-white text-xs font-bold rounded-full tracking-wider uppercase">
                      Most Popular
                    </span>
                  </div>
                )}
                <div>
                  <h3 className={`text-lg font-bold mb-1 ${plan.highlight ? "text-surface" : "text-on-surface"}`}>
                    {plan.name}
                  </h3>
                  <div className={`text-4xl font-extrabold ${plan.highlight ? "text-surface" : "text-on-surface"}`}>
                    {plan.price}
                    <span className={`text-base font-normal ${plan.highlight ? "text-surface/60" : "text-on-surface-variant"}`}>
                      {plan.period}
                    </span>
                  </div>
                </div>
                <ul className="space-y-3 flex-1">
                  {[plan.messages, plan.docs, "Custom widget", "Full conversation logs", "Analytics dashboard"].map(
                    (feat) => (
                      <li key={feat} className="flex items-center gap-3">
                        <span
                          className="material-symbols-outlined text-primary text-base flex-shrink-0"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                        <span className={`text-sm ${plan.highlight ? "text-surface/80" : "text-on-surface-variant"}`}>
                          {feat}
                        </span>
                      </li>
                    )
                  )}
                </ul>
                <Link
                  href="/signup"
                  className={`block text-center py-3 rounded-full font-bold transition-all active:scale-95 ${
                    plan.highlight
                      ? "bg-primary text-white hover:bg-primary-container"
                      : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="testimonials" className="py-24 bg-surface px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl md:text-5xl font-bold text-on-surface">What Our Clients Say</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                quote:
                  "The 24/7 Auto-Reply didn't just replace our support team; it empowered them. We saw a 60% reduction in ticket volume within the first month.",
                name: "Marcus Thorne",
                title: "CTO at Nexus Corp",
                avatar:
                  "https://lh3.googleusercontent.com/aida-public/AB6AXuCLr2po0ngwhPkAiesYxTnHeIgSbkgBWBr6S5F3Gp6zLntVo1XoQSziCsJAGYjwysszE_DxIxFnQJr8VXbovFBGlzavWOKN6qvc9XazWXSu5B8trsryig_vhl1HEYQrYmwJjAhj-qcMTPHNUHfGOSgJ-D4xTmcKQSsv6NNLHhjirU4n9IGQ652c2CMTN7TUNFRGiy0LoCoxxNzuELyq6-zQB1i3JsdeE2yTs_IMdvO6amaFng0dqtud7KScJYj91tNh9TlZIHD_TTY",
              },
              {
                quote:
                  "The Lead Generation AI is a game changer. We're capturing 3x more qualified leads by identifying high-intent visitors in real-time.",
                name: "Sarah Jenkins",
                title: "Marketing Director, FlowState",
                avatar:
                  "https://lh3.googleusercontent.com/aida-public/AB6AXuDmzYUULbYq6Dikn-bDqNjP1UZ57XEOtX4mZ6RI05RnKxq_yOwB8myHVrbVDDYorI5kpXg1AiDis3AnynINEKHqzEbtfOF9t1rvc01bXwKZU3Uxwfp1b1XHf1m5rYxrMqVBkDnRc-U4ZisCHkFPy8BaYUr1S4Zfrw8TMi1eBKRD84aIW6823XS9m-kBAG0D-ApiD4N4-P59EsFVhPLX-TpnSRjRryoLAphpBpikKYaY7oV32Ctjvrog0vNUTfv_GzVgCRBIazio_qE",
              },
              {
                quote:
                  "The conversation logging is brilliant. We can see exactly how the AI handles complex issues before a human takeover happens. Absolute transparency.",
                name: "David Chen",
                title: "Founder, Horizon Scale",
                avatar:
                  "https://lh3.googleusercontent.com/aida-public/AB6AXuCc-MyRP56Hra-0bUNPXd1hrTfSrxTmSD-_imH2jhG0gRCTBAp2O6y0Pkp8qlvgiUHC5TlMEd814ww5XcIB2QOw3N_0x_dkhPpH7azuZj2wkJ6hU8o7xjEhWG8_AZ34wvYjoMmV4j4ammLXNXPqJPTqN68Fi5NmVyN_b75kjV6kOUQ6rdK_NuEoMQHFkNtNMWoYEIea9-UuCu1jn53yazAZbHswH3CJekNw8kPbaMH0P7TaSoUA5lPcyLLrLxz0aBSqUaA1eAVyva0",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="bg-surface-container-lowest p-8 rounded-3xl shadow-sm border border-outline-variant/10 flex flex-col justify-between"
              >
                <div className="space-y-6">
                  <div className="flex text-primary">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className="material-symbols-outlined"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        star
                      </span>
                    ))}
                  </div>
                  <p className="italic text-on-surface-variant text-lg">"{t.quote}"</p>
                </div>
                <div className="mt-8 flex items-center gap-4">
                  <img
                    src={t.avatar}
                    alt={t.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-bold">{t.name}</div>
                    <div className="text-sm text-on-surface-variant">{t.title}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20 px-8 bg-primary">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white">
            Ready to Launch Your AI Assistant?
          </h2>
          <p className="text-white/80 text-xl">
            Join thousands of businesses capturing more leads and delighting customers — 24/7.
          </p>
          <Link
            href="/signup"
            className="inline-block mt-4 px-10 py-5 bg-white text-primary rounded-full text-lg font-bold shadow-xl hover:bg-primary-fixed active:scale-95 transition-all"
          >
            Start for Free — No Credit Card Required
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="w-full py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-8 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="text-xl font-bold text-slate-900">ChatBot AI</div>
            <p className="text-sm text-slate-500 max-w-sm leading-relaxed">
              Empowering businesses with high-octane intelligence. Automated engagement that
              never sleeps.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-slate-500 hover:text-[#F15A24] transition-all">
                <span className="material-symbols-outlined">public</span>
              </a>
              <a href="#" className="text-slate-500 hover:text-[#F15A24] transition-all">
                <span className="material-symbols-outlined">hub</span>
              </a>
              <a href="#" className="text-slate-500 hover:text-[#F15A24] transition-all">
                <span className="material-symbols-outlined">alternate_email</span>
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-bold text-on-surface">Product</h4>
              <nav className="flex flex-col space-y-2">
                <a href="#features" className="text-slate-500 hover:text-[#F15A24] underline-offset-4 hover:underline transition-all text-sm">
                  Features
                </a>
                <a href="#pricing" className="text-slate-500 hover:text-[#F15A24] underline-offset-4 hover:underline transition-all text-sm">
                  Pricing
                </a>
                <Link href="/login" className="text-slate-500 hover:text-[#F15A24] underline-offset-4 hover:underline transition-all text-sm">
                  Login
                </Link>
              </nav>
            </div>
            <div className="space-y-4">
              <h4 className="font-bold text-on-surface">Legal</h4>
              <nav className="flex flex-col space-y-2">
                <a href="#" className="text-slate-500 hover:text-[#F15A24] underline-offset-4 hover:underline transition-all text-sm">
                  Privacy Policy
                </a>
                <a href="#" className="text-slate-500 hover:text-[#F15A24] underline-offset-4 hover:underline transition-all text-sm">
                  Terms of Service
                </a>
              </nav>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-8 mt-12 pt-8 border-t border-slate-200">
          <p className="text-sm text-slate-500">© 2024 ChatBot AI. High-Octane Intelligence.</p>
        </div>
      </footer>

      <HelpChatWidget side="right" />
    </div>
  );
}
