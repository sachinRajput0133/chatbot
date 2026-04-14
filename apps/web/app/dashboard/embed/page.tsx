"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PLATFORMS = (botId: string) => [
  {
    id: "html",
    label: "HTML / JS",
    code: `<!-- ChatBot AI Widget -->
<script>
  window.ChatbotConfig = { botId: '${botId}' };
</script>
<script async src="${API_URL}/widget.js"></script>`,
    steps: [
      "Copy the code snippet above",
      "Paste it before the closing </body> tag on your website",
      "Save and publish — the chat bubble appears instantly",
    ],
  },
  {
    id: "react",
    label: "React",
    code: `import { useEffect } from 'react';

export function ChatbotWidget() {
  useEffect(() => {
    window.ChatbotConfig = { botId: '${botId}' };
    const script = document.createElement('script');
    script.src = '${API_URL}/widget.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);
  return null;
}

// Add <ChatbotWidget /> in App.jsx or root layout`,
    steps: [
      "Create ChatbotWidget.jsx with the code above",
      "Import and add <ChatbotWidget /> in your App.jsx or root layout",
      "Run your app — chat bubble appears on every page",
    ],
  },
  {
    id: "nextjs",
    label: "Next.js",
    code: `// app/components/ChatbotWidget.tsx
'use client';
import { useEffect } from 'react';

export function ChatbotWidget() {
  useEffect(() => {
    (window as any).ChatbotConfig = { botId: '${botId}' };
    const script = document.createElement('script');
    script.src = '${API_URL}/widget.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);
  return null;
}

// Add <ChatbotWidget /> in app/layout.tsx inside <body>`,
    steps: [
      "Create app/components/ChatbotWidget.tsx with the code above",
      "Import it in app/layout.tsx and add <ChatbotWidget /> inside <body>",
      "Widget loads client-side on every page automatically",
    ],
  },
  {
    id: "vue",
    label: "Vue",
    code: `<!-- components/ChatbotWidget.vue -->
<script setup>
import { onMounted, onUnmounted } from 'vue';
let script;
onMounted(() => {
  window.ChatbotConfig = { botId: '${botId}' };
  script = document.createElement('script');
  script.src = '${API_URL}/widget.js';
  script.async = true;
  document.body.appendChild(script);
});
onUnmounted(() => { if (script) document.body.removeChild(script); });
</script>

<!-- Add <ChatbotWidget /> in App.vue or layouts/default.vue -->`,
    steps: [
      "Create components/ChatbotWidget.vue with the code above",
      "Add <ChatbotWidget /> in App.vue or your root layout",
      "Works with Vue 3 and Nuxt 3 out of the box",
    ],
  },
  {
    id: "wordpress",
    label: "WordPress",
    code: `<!-- Paste in Appearance → Theme Editor → footer.php
     just before the closing </body> tag -->

<script>
  window.ChatbotConfig = { botId: '${botId}' };
</script>
<script async src="${API_URL}/widget.js"></script>`,
    steps: [
      "Go to Appearance → Theme Editor in WP admin",
      "Open footer.php and paste before </body>",
      "Click Update File — widget appears site-wide",
    ],
  },
];

const CHECKLIST = [
  { label: "Add the script to your website", done: true },
  { label: "Upload knowledge base documents", done: false },
  { label: "Customize bot name and color", done: false },
  { label: "Test your chatbot live", done: false },
];

export default function EmbedPage() {
  const router = useRouter();
  const [botId, setBotId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("html");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.me()
      .then((d) => setBotId(d.tenant.bot_id))
      .catch(() => router.push("/login"));
  }, []);

  if (!botId) {
    return (
      <div className="p-10 flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-sm font-bold">Loading...</div>
      </div>
    );
  }

  const platforms = PLATFORMS(botId);
  const active = platforms.find((p) => p.id === activeTab)!;

  function copy() {
    navigator.clipboard.writeText(active.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-10 max-w-7xl" style={{ fontFamily: "'Manrope', sans-serif" }}>

      {/* Hero */}
      <section className="mb-12">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
          <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>rocket_launch</span>
          Deployment Guide
        </span>
        <h1 className="text-5xl font-black tracking-tighter text-gray-900 leading-tight mb-4">
          Bring your AI to life{" "}
          <span className="text-orange-600 italic">anywhere.</span>
        </h1>
        <p className="text-lg text-gray-500 font-medium max-w-xl leading-relaxed">
          Paste one script tag and your intelligent chatbot goes live — no developer required.
          Works on any platform, any website.
        </p>
      </section>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* ── Left Column ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Tab bar */}
          <div className="flex p-1.5 bg-gray-100 rounded-2xl gap-1">
            {platforms.map((p) => (
              <button
                key={p.id}
                onClick={() => { setActiveTab(p.id); setCopied(false); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeTab === p.id
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-400 hover:text-gray-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Code block */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#191c1d" }}>
            {/* Terminal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500/70" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <span className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <span className="text-[11px] font-mono text-gray-500">
                  {activeTab === "html" || activeTab === "wordpress" ? "embed.html" :
                   activeTab === "react" ? "ChatbotWidget.jsx" :
                   activeTab === "nextjs" ? "ChatbotWidget.tsx" :
                   activeTab === "vue" ? "ChatbotWidget.vue" : "embed.html"}
                </span>
              </div>
              <button
                onClick={copy}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  copied
                    ? "bg-emerald-500 text-white"
                    : "bg-white text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                  {copied ? "check" : "content_copy"}
                </span>
                {copied ? "Copied!" : "Copy Code"}
              </button>
            </div>
            {/* Code content */}
            <pre className="p-6 font-mono text-sm text-green-400 overflow-x-auto leading-relaxed whitespace-pre">
              {active.code}
            </pre>
          </div>

          {/* Pro Tip */}
          <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100 flex gap-4">
            <div className="shrink-0 w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-orange-600" style={{ fontSize: "20px" }}>
                tips_and_updates
              </span>
            </div>
            <div>
              <h5 className="font-bold text-gray-900 text-sm mb-1">Pro Tip</h5>
              <p className="text-xs text-gray-500 leading-relaxed">
                Place the script tags just before the closing <code className="bg-orange-100 px-1 rounded text-orange-700">&lt;/body&gt;</code> tag
                for optimal performance. This ensures your page content loads first and the chatbot
                widget loads without blocking the initial render.
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: "0px 4px 20px rgba(25,28,29,0.06)" }}>
            <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600" style={{ fontSize: "20px" }}>
                checklist
              </span>
              How to Add It
            </h4>
            <ol className="space-y-3">
              {active.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white mt-0.5"
                    style={{ backgroundColor: "#a93200" }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-600 leading-relaxed">{s}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Troubleshooting */}
          <div>
            <h4 className="text-lg font-black text-gray-900 mb-4">Troubleshooting</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-6" style={{ boxShadow: "0px 4px 20px rgba(25,28,29,0.06)" }}>
                <div className="flex items-start gap-3 mb-3">
                  <span className="material-symbols-outlined text-orange-500" style={{ fontSize: "20px" }}>
                    help_outline
                  </span>
                  <h5 className="font-bold text-gray-900 text-sm">Widget Not Showing?</h5>
                </div>
                <ul className="text-xs text-gray-500 space-y-1.5 leading-relaxed">
                  <li>• Ensure the script is before <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code></li>
                  <li>• Check browser console for JS errors</li>
                  <li>• Verify your bot ID matches your account</li>
                  <li>• Disable ad-blockers and retry</li>
                </ul>
              </div>
              <div className="bg-white rounded-2xl p-6" style={{ boxShadow: "0px 4px 20px rgba(25,28,29,0.06)" }}>
                <div className="flex items-start gap-3 mb-3">
                  <span className="material-symbols-outlined text-blue-500" style={{ fontSize: "20px" }}>
                    speed
                  </span>
                  <h5 className="font-bold text-gray-900 text-sm">Performance Concerns?</h5>
                </div>
                <ul className="text-xs text-gray-500 space-y-1.5 leading-relaxed">
                  <li>• Widget loads asynchronously — no render blocking</li>
                  <li>• Script is under 15KB gzipped</li>
                  <li>• Lazy-loads only when page is idle</li>
                  <li>• No third-party trackers included</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="lg:w-80 shrink-0 space-y-6">

          {/* Bot ID card */}
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: "0px 4px 20px rgba(25,28,29,0.06)" }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Live Status</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">Your unique Bot ID — included automatically in all code snippets above.</p>
            <div className="bg-gray-50 rounded-xl p-3 font-mono text-xs text-gray-700 break-all border border-gray-200">
              {botId}
            </div>
          </div>

          {/* Integration Checklist */}
          <div className="bg-white rounded-2xl p-6" style={{ boxShadow: "0px 4px 20px rgba(25,28,29,0.06)" }}>
            <h5 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-600" style={{ fontSize: "18px" }}>
                task_alt
              </span>
              Integration Checklist
            </h5>
            <ul className="space-y-3">
              {CHECKLIST.map((item) => (
                <li key={item.label} className="flex items-center gap-3">
                  <span
                    className={`material-symbols-outlined shrink-0 ${item.done ? "text-emerald-500" : "text-gray-300"}`}
                    style={{ fontSize: "20px", fontVariationSettings: item.done ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    check_circle
                  </span>
                  <span className={`text-xs font-medium ${item.done ? "text-gray-900" : "text-gray-400"}`}>
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Documentation links */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h5 className="font-bold text-gray-700 mb-3 text-sm">Documentation</h5>
            <ul className="space-y-2">
              {[
                { label: "API Reference", icon: "api" },
                { label: "Widget Configuration", icon: "settings" },
                { label: "Custom Styling Guide", icon: "palette" },
              ].map((doc) => (
                <li key={doc.label}>
                  <button className="flex items-center gap-2.5 text-xs text-gray-600 font-medium hover:text-orange-600 transition-colors w-full text-left group">
                    <span className="material-symbols-outlined text-gray-400 group-hover:text-orange-500" style={{ fontSize: "16px" }}>
                      {doc.icon}
                    </span>
                    {doc.label}
                    <span className="material-symbols-outlined ml-auto text-gray-300" style={{ fontSize: "14px" }}>
                      chevron_right
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Custom integration CTA */}
          <div
            className="rounded-2xl p-6 relative overflow-hidden"
            style={{ backgroundColor: "#191c1d" }}
          >
            <div
              className="absolute top-0 right-0 w-24 h-24 blur-2xl -mr-6 -mt-6"
              style={{ backgroundColor: "rgba(169,50,0,0.3)" }}
            />
            <div className="relative z-10">
              <h5 className="font-bold text-white mb-2 text-sm">Need a Custom Integration?</h5>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                Our team can handle any bespoke setup — custom domains, CRM integrations, or enterprise deployments.
              </p>
              <button className="w-full py-3 bg-white text-gray-900 rounded-full text-xs font-bold hover:bg-orange-600 hover:text-white transition-all">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
