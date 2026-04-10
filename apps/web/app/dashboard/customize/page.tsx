"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

export default function CustomizePage() {
  const router = useRouter();
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState({
    bot_name: "Assistant",
    primary_color: "#6366f1",
    welcome_message: "Hi! How can I help you today?",
    position: "bottom-right",
    system_prompt: "",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getWidgetConfig()
      .then((c) => setConfig((prev) => ({ ...prev, ...c })))
      .catch(() => router.push("/login"));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateWidgetConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  function handleDiscard() {
    api.getWidgetConfig()
      .then((c) => setConfig((prev) => ({ ...prev, ...c })))
      .catch(() => {});
  }

  return (
    <div className="p-10 max-w-7xl" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="flex flex-col lg:flex-row gap-12">
        {/* ── Left Column: Configuration Form ── */}
        <div className="flex-1 space-y-10">
          <section>
            <h2 className="text-3xl font-black tracking-tight text-gray-900 mb-2">Customize Bot</h2>
            <p className="text-gray-500 text-lg max-w-lg">
              Tailor your AI agent's personality and appearance to match your brand's unique identity.
            </p>
          </section>

          <form onSubmit={handleSave} className="space-y-8">
            {/* Basic Info Card */}
            <div className="bg-gray-50 p-8 rounded-xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bot Name */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 ml-1">Bot Name</label>
                  <input
                    type="text"
                    value={config.bot_name}
                    onChange={(e) => setConfig({ ...config, bot_name: e.target.value })}
                    className="w-full bg-white border border-gray-200 focus:border-orange-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all"
                  />
                </div>

                {/* Position toggle */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 ml-1">Position</label>
                  <div className="flex p-1 bg-gray-200 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, position: "bottom-right" })}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                        config.position === "bottom-right"
                          ? "bg-white shadow-sm text-gray-900"
                          : "text-gray-400 hover:text-gray-700"
                      }`}
                    >
                      Right
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, position: "bottom-left" })}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                        config.position === "bottom-left"
                          ? "bg-white shadow-sm text-gray-900"
                          : "text-gray-400 hover:text-gray-700"
                      }`}
                    >
                      Left
                    </button>
                  </div>
                </div>
              </div>

              {/* Brand Color */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-500 ml-1">Brand Color</label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => colorInputRef.current?.click()}
                    className="w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer hover:scale-105 transition-transform shadow-md shrink-0"
                    style={{ backgroundColor: config.primary_color }}
                  >
                    <span className="material-symbols-outlined text-white" style={{ fontSize: "20px" }}>colorize</span>
                  </button>
                  <input
                    ref={colorInputRef}
                    type="color"
                    value={config.primary_color}
                    onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                    className="sr-only"
                  />
                  <input
                    type="text"
                    value={config.primary_color}
                    onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                    className="flex-1 bg-white border border-gray-200 focus:border-orange-500 rounded-xl px-4 py-3 text-gray-900 font-mono font-medium outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Content Card */}
            <div className="bg-gray-50 p-8 rounded-xl space-y-6">
              {/* Welcome Message */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-500 ml-1">Welcome Message</label>
                <input
                  type="text"
                  value={config.welcome_message}
                  onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
                  className="w-full bg-white border border-gray-200 focus:border-orange-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all"
                />
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-bold text-gray-500">Custom System Prompt</label>
                  <span className="text-[10px] font-bold text-orange-600 uppercase bg-orange-50 px-2 py-0.5 rounded">
                    Expert Mode
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={config.system_prompt}
                  onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
                  placeholder="e.g. You are a helpful customer support agent for Acme Inc. Always be concise and friendly."
                  className="w-full bg-white border border-gray-200 focus:border-orange-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all resize-none"
                />
                <p className="text-[11px] text-gray-400 italic mt-1">
                  The system prompt defines how the AI behaves during all interactions.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={handleDiscard}
                className="px-8 py-3 rounded-full font-bold text-gray-400 hover:bg-gray-100 transition-colors"
              >
                Discard Changes
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-10 py-3 rounded-full font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-60 ${
                  saved
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-900 text-white"
                }`}
              >
                {saved ? "Saved!" : loading ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </form>
        </div>

        {/* ── Right Column: Live Preview ── */}
        <div className="lg:w-[380px] flex flex-col gap-6 shrink-0">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] px-2">Live Preview</h3>

          {/* Phone frame */}
          <div
            className="relative w-full bg-gray-100 rounded-[2.5rem] overflow-hidden flex flex-col border-[12px] border-gray-900"
            style={{ aspectRatio: "4/5" }}
          >
            {/* Chat header */}
            <div
              className="p-5 flex items-center justify-between text-white shrink-0"
              style={{ backgroundColor: config.primary_color }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-white"
                    style={{ fontSize: "20px", fontVariationSettings: "'FILL' 1" }}
                  >
                    smart_toy
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-sm">{config.bot_name || "Assistant"}</h4>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    <span className="text-[10px] opacity-80 font-medium">Online &amp; Ready</span>
                  </div>
                </div>
              </div>
              <span className="material-symbols-outlined cursor-pointer opacity-70" style={{ fontSize: "20px" }}>close</span>
            </div>

            {/* Chat body */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-white">
              {/* Bot welcome */}
              <div className="flex gap-2">
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: config.primary_color + "22" }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "13px", color: config.primary_color, fontVariationSettings: "'FILL' 1" }}
                  >
                    smart_toy
                  </span>
                </div>
                <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-none max-w-[85%]">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {config.welcome_message || "Hi! How can I help you today?"}
                  </p>
                </div>
              </div>

              {/* User message */}
              <div className="flex justify-end">
                <div className="bg-gray-900 text-white p-3 rounded-2xl rounded-tr-none max-w-[85%]">
                  <p className="text-xs leading-relaxed">How do I get started?</p>
                </div>
              </div>

              {/* Bot reply */}
              <div className="flex gap-2">
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: config.primary_color + "22" }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "13px", color: config.primary_color, fontVariationSettings: "'FILL' 1" }}
                  >
                    smart_toy
                  </span>
                </div>
                <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-none max-w-[85%]">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    I'm here to help! You can ask me anything about our products and services.
                  </p>
                </div>
              </div>

              {/* Typing indicator */}
              <div className="flex gap-2 opacity-50">
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center"
                  style={{ backgroundColor: config.primary_color + "22" }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "13px", color: config.primary_color }}
                  >
                    smart_toy
                  </span>
                </div>
                <div className="bg-gray-100 px-4 py-3 rounded-full flex gap-1 items-center">
                  <span className="w-1 h-1 rounded-full bg-gray-400 inline-block" />
                  <span className="w-1 h-1 rounded-full bg-gray-400 inline-block" />
                  <span className="w-1 h-1 rounded-full bg-gray-400 inline-block" />
                </div>
              </div>
            </div>

            {/* Input bar */}
            <div className="p-4 bg-white border-t border-gray-100 shrink-0">
              <div className="flex items-center gap-2 bg-gray-100 px-4 py-2.5 rounded-full">
                <input
                  className="bg-transparent outline-none flex-1 text-xs font-medium text-gray-400"
                  disabled
                  placeholder="Type a message..."
                  type="text"
                />
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "18px", color: config.primary_color, fontVariationSettings: "'FILL' 1" }}
                >
                  send
                </span>
              </div>
              <p className="text-[9px] text-center text-gray-300 mt-2">Powered by ChatBot AI</p>
            </div>
          </div>

          {/* Pro Tip card */}
          <div className="bg-orange-50 p-6 rounded-3xl border border-orange-100">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-orange-600" style={{ fontSize: "20px" }}>tips_and_updates</span>
              <h5 className="font-bold text-gray-900 text-sm">Pro Tip</h5>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Using a contrasting <strong>Brand Color</strong> helps the widget stand out on your website, leading to higher engagement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
