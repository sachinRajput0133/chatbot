"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PLATFORMS = (botId: string) => [
  {
    id: "html",
    label: "HTML / Any Website",
    icon: "🌐",
    description: "Works on any website — WordPress, Wix, Shopify, Squarespace, plain HTML.",
    code: `<!-- ChatBot AI Widget -->
<script>
  window.ChatbotConfig = { botId: '${botId}' };
</script>
<script async src="${API_URL}/widget.js"></script>`,
    language: "html",
    steps: [
      "Copy the code above",
      "Paste it before the closing </body> tag on your website",
      "Save and publish — the chat bubble appears instantly",
    ],
  },
  {
    id: "react",
    label: "React (CRA / Vite)",
    icon: "⚛️",
    description: "For any React app built with Create React App, Vite, or similar.",
    code: `// Option 1 — Add to public/index.html (simplest)
// Paste before </body> in public/index.html:
// <script>window.ChatbotConfig = { botId: '${botId}' };</script>
// <script async src="${API_URL}/widget.js"></script>

// Option 2 — Load dynamically in a component
import { useEffect } from 'react';

export function ChatbotWidget() {
  useEffect(() => {
    window.ChatbotConfig = { botId: '${botId}' };

    const script = document.createElement('script');
    script.src = '${API_URL}/widget.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null; // renders nothing — widget injects its own UI
}

// Then in App.jsx / layout:
// import { ChatbotWidget } from './ChatbotWidget';
// <ChatbotWidget />`,
    language: "jsx",
    steps: [
      "Create ChatbotWidget.jsx with the code above",
      "Import and add <ChatbotWidget /> in your App.jsx or root layout",
      "Run your app — chat bubble appears on every page",
    ],
  },
  {
    id: "nextjs",
    label: "Next.js",
    icon: "▲",
    description: "For Next.js 13+ App Router or Pages Router.",
    code: `// app/components/ChatbotWidget.tsx  (App Router)
'use client';
import { useEffect } from 'react';

export function ChatbotWidget() {
  useEffect(() => {
    (window as any).ChatbotConfig = { botId: '${botId}' };

    const script = document.createElement('script');
    script.src = '${API_URL}/widget.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}

// app/layout.tsx — add to your root layout:
// import { ChatbotWidget } from './components/ChatbotWidget';
// ...
// <body>
//   {children}
//   <ChatbotWidget />
// </body>`,
    language: "tsx",
    steps: [
      "Create app/components/ChatbotWidget.tsx with the code above",
      "Import it in app/layout.tsx and add <ChatbotWidget /> inside <body>",
      "Widget loads client-side on every page automatically",
    ],
  },
  {
    id: "vue",
    label: "Vue / Nuxt",
    icon: "💚",
    description: "For Vue 3 apps or Nuxt 3.",
    code: `<!-- components/ChatbotWidget.vue -->
<template>
  <!-- widget renders its own UI, nothing needed here -->
</template>

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

onUnmounted(() => {
  if (script) document.body.removeChild(script);
});
</script>

<!-- In App.vue or layouts/default.vue: -->
<!-- <ChatbotWidget /> -->`,
    language: "vue",
    steps: [
      "Create components/ChatbotWidget.vue with the code above",
      "Add <ChatbotWidget /> in App.vue or your root layout",
      "Works with Vue 3 and Nuxt 3 out of the box",
    ],
  },
  {
    id: "wordpress",
    label: "WordPress",
    icon: "📝",
    description: "Add via Theme Editor or a plugin.",
    code: `<!-- Paste in Appearance → Theme Editor → footer.php,
     just before the closing </body> tag -->

<script>
  window.ChatbotConfig = { botId: '${botId}' };
</script>
<script async src="${API_URL}/widget.js"></script>`,
    language: "html",
    steps: [
      "Go to Appearance → Theme Editor in your WP admin",
      "Open footer.php (or Theme Footer)",
      "Paste the code just before </body>",
      "Click Update File",
    ],
  },
  {
    id: "shopify",
    label: "Shopify",
    icon: "🛍️",
    description: "Add via the Shopify theme code editor.",
    code: `<!-- Online Store → Themes → Edit Code → theme.liquid
     Paste just before </body> -->

<script>
  window.ChatbotConfig = { botId: '${botId}' };
</script>
<script async src="${API_URL}/widget.js"></script>`,
    language: "html",
    steps: [
      "Go to Online Store → Themes in Shopify admin",
      "Click Actions → Edit Code",
      "Open theme.liquid",
      "Paste just before </body> and save",
    ],
  },
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

  if (!botId) return <div className="text-gray-400">Loading...</div>;

  const platforms = PLATFORMS(botId);
  const active = platforms.find((p) => p.id === activeTab)!;

  function copy() {
    navigator.clipboard.writeText(active.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-1">Embed Code</h1>
      <p className="text-gray-500 text-sm mb-6">
        Add your chatbot to any website or framework — pick your platform below.
      </p>

      {/* Platform tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {platforms.map((p) => (
          <button
            key={p.id}
            onClick={() => { setActiveTab(p.id); setCopied(false); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition border ${
              activeTab === p.id
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
            }`}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <p className="text-gray-500 text-sm mb-3">{active.description}</p>

      {/* Code block */}
      <div className="relative bg-gray-900 rounded-xl p-5 font-mono text-sm text-green-400 overflow-x-auto whitespace-pre mb-3">
        {active.code}
        <button
          onClick={copy}
          className={`absolute top-3 right-3 px-3 py-1 rounded text-xs font-semibold transition ${
            copied ? "bg-green-600 text-white" : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Steps */}
      <div className="bg-white border rounded-xl p-4 mb-6">
        <div className="text-sm font-semibold text-gray-700 mb-2">How to add it:</div>
        <ol className="text-sm text-gray-500 list-decimal list-inside space-y-1">
          {active.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </div>

      {/* Bot ID info */}
      <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-700">
        <strong>Your Bot ID:</strong>{" "}
        <code className="bg-indigo-100 px-1.5 py-0.5 rounded text-xs">{botId}</code>
        <p className="text-xs mt-1 text-indigo-500">
          This is unique to your account. The widget uses it to load your knowledge base and settings.
        </p>
      </div>
    </div>
  );
}
