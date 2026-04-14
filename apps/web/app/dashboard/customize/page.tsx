"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

const TONE_OPTIONS = ["Professional", "Friendly", "Technical", "Sales-focused", "Casual", "Empathetic"];

export default function CustomizePage() {
  const router = useRouter();
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState({
    bot_name: "Assistant",
    primary_color: "#6366f1",
    welcome_message: "Hi! How can I help you today?",
    position: "bottom-right",
    system_prompt: "",
    // Brand Voice
    company_website: "",
    company_email: "",
    company_address: "",
    company_phone: "",
    business_hours: "",
    tone_of_voice: "",
    target_audience: "",
    brand_values: "",
    what_we_do: "",
    unique_selling_proposition: "",
    suggested_questions: [] as string[],
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brandVoiceOpen, setBrandVoiceOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    api.getWidgetConfig()
      .then((c: any) => setConfig((prev) => ({ ...prev, ...c })))
      .catch(() => router.push("/login"));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanQuestions = config.suggested_questions.filter(q => q.trim().length > 0);
      await api.updateWidgetConfig({ ...config, suggested_questions: cleanQuestions });
      setSaved(true);
      setConfig(prev => ({ ...prev, suggested_questions: cleanQuestions }));
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  function handleDiscard() {
    api.getWidgetConfig()
      .then((c: any) => setConfig((prev) => ({ ...prev, ...c })))
      .catch(() => { });
  }

  const field = (key: keyof typeof config) => ({
    value: (config[key] as string) || "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setConfig({ ...config, [key]: e.target.value }),
  });

  console.log(`🚀 ~ CustomizePage ~                   <input className="bg-transparent outline-none flex-1 text-[14px] text-zinc-900" disabled placeholder="Ask me anything...sasas" type="text" />
:`, <input className="bg-transparent outline-none flex-1 text-[14px] text-zinc-900" disabled placeholder="Ask me anything..." type="text" />
  )
  return (
    <div className="p-10 max-w-7xl" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="flex flex-col lg:flex-row gap-12">
        {/* ── Left Column: Configuration Form ── */}
        <div className="flex-1 space-y-8">
          <section>
            <h2 className="text-3xl font-black tracking-tight text-gray-900 mb-2">Customize Bot</h2>
            <p className="text-gray-500 text-lg max-w-lg">
              Tailor your AI agent's personality and appearance to match your brand.
            </p>
          </section>

          <form onSubmit={handleSave} className="space-y-6">
            {/* ── Appearance ── */}
            <div className="bg-gray-50 p-8 rounded-xl space-y-6">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">Appearance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 ml-1">Bot Name</label>
                  <input
                    type="text"
                    {...field("bot_name")}
                    className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-500 ml-1">Position</label>
                  <div className="flex p-1 bg-gray-200 rounded-xl">
                    {["bottom-right", "bottom-left"].map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setConfig({ ...config, position: pos })}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${config.position === pos
                          ? "bg-white shadow-sm text-gray-900"
                          : "text-gray-400 hover:text-gray-700"
                          }`}
                      >
                        {pos === "bottom-right" ? "Right" : "Left"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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
                  <input ref={colorInputRef} type="color" {...field("primary_color")} className="sr-only" />
                  <input
                    type="text"
                    {...field("primary_color")}
                    className="flex-1 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-mono font-medium outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-500 ml-1">Welcome Message</label>
                <textarea
                  rows={3}
                  {...field("welcome_message")}
                  className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all resize-none"
                />
              </div>
              <div className="space-y-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-gray-500 ml-1">Suggested Questions</label>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, suggested_questions: [...config.suggested_questions, ""] })}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                    Add Question
                  </button>
                </div>
                <p className="text-xs text-gray-400 ml-1 mb-2">Show clickable ideas to visitors before they type.</p>

                <div className="space-y-3">
                  {config.suggested_questions.length === 0 ? (
                    <div className="text-center py-6 bg-white border border-dashed border-gray-300 rounded-xl">
                      <p className="text-xs text-gray-400 font-medium">No suggested questions added.</p>
                    </div>
                  ) : (
                    config.suggested_questions.map((q, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-gray-300" style={{ fontSize: "18px" }}>chat_bubble</span>
                        <input
                          type="text"
                          value={q}
                          onChange={(e) => {
                            const newQs = [...config.suggested_questions];
                            newQs[idx] = e.target.value;
                            setConfig({ ...config, suggested_questions: newQs });
                          }}
                          placeholder="e.g. Do you offer a free trial?"
                          className="flex-1 bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-gray-900 text-sm font-medium outline-none transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newQs = config.suggested_questions.filter((_, i) => i !== idx);
                            setConfig({ ...config, suggested_questions: newQs });
                          }}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-100 transition-colors shrink-0"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>delete</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* ── Brand Voice (collapsible) ── */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setBrandVoiceOpen(!brandVoiceOpen)}
                className="w-full flex items-center justify-between px-6 py-4 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-indigo-500" style={{ fontSize: "20px" }}>record_voice_over</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900 text-sm">Brand Voice</p>
                    <p className="text-xs text-gray-400">Help the AI understand your business — auto-generates a smart system prompt</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-gray-400" style={{ fontSize: "20px" }}>
                  {brandVoiceOpen ? "expand_less" : "expand_more"}
                </span>
              </button>

              {brandVoiceOpen && (
                <div className="px-6 pb-6 pt-2 bg-gray-50 space-y-5">
                  {/* Tone */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500">Tone of Voice</label>
                    <select
                      {...field("tone_of_voice")}
                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all"
                    >
                      <option value="">Select a tone...</option>
                      {TONE_OPTIONS.map((t) => (
                        <option key={t} value={t.toLowerCase()}>{t}</option>
                      ))}
                    </select>
                  </div>

                  {/* What we do */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500">What does your business do?</label>
                    <textarea
                      rows={3}
                      {...field("what_we_do")}
                      placeholder="e.g. We provide cloud-based HR software for small and mid-sized businesses..."
                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all resize-none"
                    />
                  </div>

                  {/* Target audience */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500">Target Audience</label>
                    <textarea
                      rows={2}
                      {...field("target_audience")}
                      placeholder="e.g. Small business owners and HR managers..."
                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all resize-none"
                    />
                  </div>

                  {/* Brand Values + USP */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500">Brand Values</label>
                      <textarea
                        rows={3}
                        {...field("brand_values")}
                        placeholder="e.g. Transparency, innovation, customer-first..."
                        className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all resize-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500">What Makes You Unique (USP)</label>
                      <textarea
                        rows={3}
                        {...field("unique_selling_proposition")}
                        placeholder="e.g. Only platform with built-in compliance automation..."
                        className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all resize-none"
                      />
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500">Company Email</label>
                      <input type="email" {...field("company_email")} placeholder="support@yourcompany.com"
                        className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500">Phone Number</label>
                      <input type="text" {...field("company_phone")} placeholder="+1 (555) 000-0000"
                        className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500">Website</label>
                      <input type="url" {...field("company_website")} placeholder="https://yourcompany.com"
                        className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-500">Business Hours</label>
                      <input type="text" {...field("business_hours")} placeholder="Mon–Fri 9AM–6PM EST"
                        className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500">Company Address</label>
                    <input type="text" {...field("company_address")} placeholder="123 Main St, City, State, ZIP"
                      className="w-full bg-white border border-gray-200 focus:border-indigo-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all" />
                  </div>

                  <div className="flex items-start gap-2 bg-indigo-50 px-4 py-3 rounded-xl">
                    <span className="material-symbols-outlined text-indigo-500 mt-0.5" style={{ fontSize: "16px" }}>auto_awesome</span>
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      Brand Voice fields auto-generate a smart system prompt. Leave the Advanced system prompt below <strong>blank</strong> to use this.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Advanced: System Prompt (collapsible) ── */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className="w-full flex items-center justify-between px-6 py-4 bg-white hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-orange-500" style={{ fontSize: "20px" }}>code</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-900 text-sm">Custom System Prompt <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded ml-1">Expert</span></p>
                    <p className="text-xs text-gray-400">Override Brand Voice with a fully custom prompt</p>
                  </div>
                </div>
                <span className="material-symbols-outlined text-gray-400" style={{ fontSize: "20px" }}>
                  {advancedOpen ? "expand_less" : "expand_more"}
                </span>
              </button>
              {advancedOpen && (
                <div className="px-6 pb-6 pt-2 bg-gray-50 space-y-3">
                  <textarea
                    rows={7}
                    {...field("system_prompt")}
                    placeholder="e.g. You are a helpful customer support agent for Acme Inc. Always be concise and friendly."
                    className="w-full bg-white border border-gray-200 focus:border-orange-500 rounded-xl px-4 py-3 text-gray-900 font-medium outline-none transition-all resize-none"
                  />
                  <p className="text-[11px] text-gray-400 italic">
                    When filled, this overrides the Brand Voice prompt entirely.
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-4 pt-2">
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
                className={`px-10 py-3 rounded-full font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 disabled:opacity-60 ${saved ? "bg-emerald-600 text-white" : "bg-gray-900 text-white"
                  }`}
              >
                {saved ? "Saved!" : loading ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </form>
        </div>

        {/* ── Right Column: Live Preview ── */}
        <div className="lg:w-[406px] flex flex-col gap-6 shrink-0">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] px-2">Live Preview</h3>

          <div
            className="relative w-full bg-gray-100 rounded-[2rem] overflow-hidden flex flex-col border-[8px] border-gray-900 shadow-2xl"
            style={{ height: "832px" }}
          >
            <div
              className="p-4 flex items-center justify-between text-white shrink-0"
              style={{ backgroundColor: config.primary_color }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden">
                  <span className="text-black font-bold text-sm">
                    {config.bot_name ? config.bot_name.charAt(0).toUpperCase() : "A"}
                  </span>
                </div>
                <h4 className="font-semibold text-sm">{config.bot_name || "Assistant"}</h4>
              </div>
              <div className="flex items-center gap-3 relative">
                <button aria-label="Menu" className="opacity-80 hover:opacity-100 flex p-0 bg-transparent border-0 text-white">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>
                <button className="opacity-80 hover:opacity-100 flex p-0 bg-transparent border-0 text-white cursor-pointer" aria-label="Close">
                  <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto bg-white text-[14px]">
              {(config.welcome_message || "Hi! How can I help you today?").split('\n').filter(m => m.trim().length > 0).map((msgLine, idx) => (
                <div key={`welcome-${idx}`} className="bg-zinc-100 text-zinc-900 py-3 px-3 rounded-xl rounded-bl-sm max-w-[85%] self-start whitespace-pre-wrap shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  {msgLine}
                </div>
              ))}

              {/* Preview Suggested Questions block dynamically pushed to bottom */}
              {config.suggested_questions.filter(q => q.trim().length > 0).length > 0 && (
                <div className="flex flex-wrap gap-2 mt-auto pt-3 justify-end">
                  {config.suggested_questions.filter(q => q.trim().length > 0).map((q, idx) => (
                    <div
                      key={idx}
                      className="px-4 py-2 text-[14px] bg-white border border-zinc-200 text-zinc-900 rounded-full cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      {q}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 bg-white border-t border-gray-100 flex flex-col">
              <div className="flex justify-center pb-2 pt-2">
                <span className="flex items-center gap-1 text-[10px] text-gray-500 bg-gray-100 px-2 py-1 rounded-md font-medium">
                  Powered by ChatBot AI
                </span>
              </div>
              <div className="px-3 pb-3">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 py-2 px-2 pl-4 rounded-full">
                  <input className="bg-transparent outline-none flex-1 text-[14px] text-zinc-900" disabled placeholder="Ask me anything..." type="text" />
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: config.primary_color }}>
                    <span className="material-symbols-outlined text-white" style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}>send</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
            <div className="flex items-center gap-3 mb-3">
              <span className="material-symbols-outlined text-indigo-600" style={{ fontSize: "20px" }}>tips_and_updates</span>
              <h5 className="font-bold text-gray-900 text-sm">Pro Tip</h5>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Fill in <strong>Brand Voice</strong> fields to give your bot real business knowledge. The AI uses this to answer "what are your hours?" and similar questions automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
