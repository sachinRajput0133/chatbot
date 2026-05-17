"use client";

import { useEffect } from "react";

const WIDGET_URL = process.env.NEXT_PUBLIC_WIDGET_URL || "http://localhost:8000/widget.js";

export default function PreviewPage({ params }: { params: { botId: string } }) {
  const { botId } = params;

  useEffect(() => {
    if (!botId) return;
    (window as any).ChatbotConfig = { botId };

    const script = document.createElement("script");
    script.id = "cb-preview-widget";
    script.src = WIDGET_URL;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.getElementById("cb-preview-widget")?.remove();
      delete (window as any).ChatbotConfig;
    };
  }, [botId]);

  return (
    <div className="min-h-screen bg-white text-slate-900" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Preview Mode banner */}
      <div className="bg-[#FFE9DF] border-b border-[#F15A24]/30 px-6 py-2.5 flex items-center justify-between text-[13px]">
        <div className="flex items-center gap-2 text-[#F15A24] font-semibold">
          <span className="material-symbols-outlined" style={{ fontSize: "18px", fontVariationSettings: "'FILL' 1" }}>
            visibility
          </span>
          Preview Mode — this is how visitors see your bot
        </div>
        <a
          href="/dashboard?tab=customize"
          className="inline-flex items-center gap-1 text-[#F15A24] font-bold hover:underline"
        >
          Edit configuration
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
        </a>
      </div>

      {/* Mock site — top nav */}
      <nav className="px-8 py-4 border-b border-gray-100 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-900 to-slate-700" />
          <span className="text-lg font-extrabold tracking-tight">Acme Inc</span>
        </div>
        <div className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-600">
          <a href="#" onClick={(e) => e.preventDefault()}>Product</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Solutions</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Pricing</a>
          <a href="#" onClick={(e) => e.preventDefault()}>Docs</a>
        </div>
        <button className="px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-bold">
          Sign in
        </button>
      </nav>

      {/* Hero */}
      <section className="px-8 py-20 text-center max-w-4xl mx-auto">
        <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-6">
          ✨ New: AI-powered workflows
        </span>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
          All-in-one platform for{" "}
          <span className="text-[#F15A24]">modern teams</span>
        </h1>
        <p className="text-lg text-slate-600 mt-6 max-w-2xl mx-auto">
          Ship faster, collaborate smarter, and delight your customers with the
          tools your team will actually love using.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <button className="px-7 py-3.5 rounded-full bg-slate-900 text-white font-bold shadow-lg">
            Get started free
          </button>
          <button className="px-7 py-3.5 rounded-full bg-white border border-slate-200 font-bold">
            Watch demo
          </button>
        </div>
      </section>

      {/* Feature grid */}
      <section className="px-8 py-16 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { icon: "bolt", title: "Lightning fast", desc: "Sub-100ms response times on every action." },
            { icon: "shield", title: "Enterprise secure", desc: "SOC 2 Type II, GDPR compliant, end-to-end encrypted." },
            { icon: "groups", title: "Built for teams", desc: "Real-time collaboration with permissions and audit logs." },
          ].map((f) => (
            <div key={f.title} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-[#FFE9DF] flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[#F15A24]" style={{ fontSize: "22px", fontVariationSettings: "'FILL' 1" }}>
                  {f.icon}
                </span>
              </div>
              <h3 className="text-lg font-extrabold mb-2">{f.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser */}
      <section className="px-8 py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Simple, transparent pricing
          </h2>
          <p className="text-slate-600 mt-3">
            Start free. Scale when you're ready. No surprises.
          </p>
          <button className="mt-6 px-7 py-3.5 rounded-full bg-[#F15A24] text-white font-bold shadow-lg">
            View plans
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-10 border-t border-slate-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div>© 2026 Acme Inc. All rights reserved.</div>
          <div className="flex items-center gap-5 font-semibold">
            <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
            <a href="#" onClick={(e) => e.preventDefault()}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
