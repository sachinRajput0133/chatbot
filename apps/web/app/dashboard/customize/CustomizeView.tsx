"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

const TONE_OPTIONS = ["Professional", "Friendly", "Technical", "Sales-focused", "Casual", "Empathetic"];
const WELCOME_MAX = 150;

type DeviceMode = "desktop" | "tablet" | "mobile";
type SectionId = "appearance" | "behavior" | "lead" | "advanced" | "custom";

interface CustomizeViewProps {
  embedded?: boolean;
}

export default function CustomizeView({ embedded = false }: CustomizeViewProps) {
  const router = useRouter();
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState({
    bot_name: "AI Assistant",
    primary_color: "#6366F1",
    welcome_message: "Hi! How can I help you today?",
    position: "bottom-right",
    system_prompt: "",
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
    default_language: "en",
    calendly_url: "",
    proactive_message: "",
    proactive_delay: 0,
    proactive_exit_intent: false,
    ai_provider: "openai",
    ai_model: "gpt-4o-mini",
    email_followup_enabled: true,
    email_followup_subject: "",
    theme: "light",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openSection, setOpenSection] = useState<SectionId>("appearance");
  const [device, setDevice] = useState<DeviceMode>("mobile");

  useEffect(() => {
    api.getWidgetConfig()
      .then((c: any) => setConfig((prev) => ({ ...prev, ...c })))
      .catch(() => router.push("/login"));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanQuestions = config.suggested_questions.filter((q) => q.trim().length > 0);
      await api.updateWidgetConfig({ ...config, suggested_questions: cleanQuestions });
      setSaved(true);
      setConfig((prev) => ({ ...prev, suggested_questions: cleanQuestions }));
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    api.getWidgetConfig()
      .then((c: any) => setConfig((prev) => ({ ...prev, ...c })))
      .catch(() => {});
  }

  function toggleSection(id: SectionId) {
    setOpenSection((prev) => (prev === id ? ("" as SectionId) : id));
  }

  const field = (key: keyof typeof config) => ({
    value: (config[key] as string) || "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setConfig({ ...config, [key]: e.target.value }),
  });

  return (
    <div className="w-full" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Page header */}
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-gray-900">Customize Bot</h1>
          <p className="text-sm text-gray-500 mt-1">Tailor your AI agent's personality and appearance to match your brand.</p>
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)_minmax(0,320px)] gap-4">
          {/* ── Left: Configuration accordion ── */}
          <div className="space-y-3 min-w-0">
            <Section
              num={1}
              id="appearance"
              title="Appearance"
              open={openSection === "appearance"}
              onToggle={() => toggleSection("appearance")}
            >
              <AppearanceForm
                config={config}
                setConfig={setConfig}
                field={field}
                colorInputRef={colorInputRef}
              />
            </Section>

            <Section
              num={2}
              id="behavior"
              title="Smart Behavior"
              subtitle="Control how your bot responds and behaves."
              open={openSection === "behavior"}
              onToggle={() => toggleSection("behavior")}
            >
              <BehaviorForm config={config} setConfig={setConfig} field={field} />
            </Section>

            <Section
              num={3}
              id="lead"
              title="Lead Capture"
              subtitle="Collect visitor information and qualify leads automatically."
              open={openSection === "lead"}
              onToggle={() => toggleSection("lead")}
            >
              <LeadCaptureForm config={config} setConfig={setConfig} field={field} />
            </Section>

            <Section
              num={4}
              id="advanced"
              title="Advanced Settings"
              subtitle="Configure AI model, fallback, and more."
              open={openSection === "advanced"}
              onToggle={() => toggleSection("advanced")}
            >
              <AdvancedForm config={config} setConfig={setConfig} field={field} />
            </Section>

            <Section
              num={5}
              id="custom"
              title="Customization"
              subtitle="Add custom CSS or JavaScript to fine-tune the widget."
              open={openSection === "custom"}
              onToggle={() => toggleSection("custom")}
            >
              <CustomForm config={config} field={field} />
            </Section>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 px-1">
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-sm font-semibold text-gray-700 transition-colors"
              >
                Reset Changes
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md shadow-violet-900/20 transition-colors disabled:opacity-60 ${
                  saved ? "bg-emerald-600" : "bg-violet-600 hover:bg-violet-500"
                }`}
              >
                {saved ? "Saved!" : loading ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>

          {/* ── Center: Live Preview ── */}
          <div className="min-w-0">
            <div className="bg-white rounded-2xl border border-gray-200/70 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-gray-900">Live Preview</h3>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDevice(d)}
                      className={`p-1.5 rounded-md transition-colors ${
                        device === d ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                      }`}
                      title={d}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                        {d === "desktop" ? "desktop_windows" : d === "tablet" ? "tablet_mac" : "phone_iphone"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-center">
                <ChatPreview config={config} device={device} />
              </div>

              <div className="flex justify-center mt-4">
                <a
                  href="#"
                  onClick={(e) => e.preventDefault()}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 transition-colors"
                >
                  Test in new tab
                  <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
                </a>
              </div>
            </div>
          </div>

          {/* ── Right: Tips & Suggested Questions ── */}
          <div className="space-y-4 min-w-0">
            <ProTipsCard />
            <SuggestedQuestionsCard config={config} setConfig={setConfig} />
            <PreviewBotCard />
            <NeedHelpCard />
          </div>
        </div>
      </form>
    </div>
  );
}

/* ───────────── Section accordion ───────────── */

function Section({
  num,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  num: number;
  id?: string;
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-gray-50/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              open ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-700"
            }`}
          >
            {num}
          </div>
          <div className="text-left min-w-0">
            <div className={`text-sm font-bold truncate ${open ? "text-violet-700" : "text-gray-900"}`}>{title}</div>
            {subtitle && !open && <div className="text-[11px] text-gray-500 truncate">{subtitle}</div>}
          </div>
        </div>
        <span className="material-symbols-outlined text-gray-400 flex-shrink-0" style={{ fontSize: "20px" }}>
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-gray-100">{children}</div>}
    </div>
  );
}

/* ───────────── Field primitives ───────────── */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-700 mb-1.5">{children}</label>;
}

function inputCls() {
  return "w-full bg-white border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-all";
}

/* ───────────── 1. Appearance ───────────── */

function AppearanceForm({
  config,
  setConfig,
  field,
  colorInputRef,
}: {
  config: any;
  setConfig: (c: any) => void;
  field: (k: any) => any;
  colorInputRef: React.RefObject<HTMLInputElement>;
}) {
  const charCount = (config.welcome_message || "").length;
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Bot Name</FieldLabel>
          <input type="text" {...field("bot_name")} className={inputCls()} />
        </div>
        <div>
          <FieldLabel>Position</FieldLabel>
          <div className="flex p-1 bg-gray-100 rounded-lg">
            {[
              { val: "bottom-right", label: "Right" },
              { val: "bottom-left", label: "Left" },
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => setConfig({ ...config, position: p.val })}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  config.position === p.val ? "bg-white shadow-sm text-violet-700" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Default Language</FieldLabel>
          <select {...field("default_language")} className={inputCls()}>
            <option value="en">English (Default)</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
          </select>
        </div>
        <div>
          <FieldLabel>Brand Color</FieldLabel>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg pl-2 pr-3.5">
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="w-7 h-7 rounded-md flex-shrink-0 cursor-pointer border border-white shadow-sm"
              style={{ backgroundColor: config.primary_color }}
            />
            <input ref={colorInputRef} type="color" {...field("primary_color")} className="sr-only" />
            <input
              type="text"
              {...field("primary_color")}
              className="flex-1 py-2.5 text-sm text-gray-900 font-mono bg-transparent outline-none"
            />
          </div>
        </div>
      </div>

      <div>
        <FieldLabel>Welcome Message</FieldLabel>
        <div className="relative">
          <textarea
            rows={3}
            maxLength={WELCOME_MAX}
            {...field("welcome_message")}
            className={`${inputCls()} resize-none pr-16`}
          />
          <span className="absolute bottom-2 right-3 text-[10px] text-gray-400 font-medium">
            {charCount} / {WELCOME_MAX}
          </span>
        </div>
      </div>

      <div>
        <FieldLabel>Widget Theme</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {[
            { val: "light", label: "Light", icon: "light_mode" },
            { val: "dark", label: "Dark", icon: "dark_mode" },
            { val: "auto", label: "Auto", icon: "hdr_auto" },
          ].map((t) => (
            <button
              key={t.val}
              type="button"
              onClick={() => setConfig({ ...config, theme: t.val })}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                config.theme === t.val
                  ? "border-violet-500 bg-violet-50 text-violet-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── 2. Smart Behavior ───────────── */

function BehaviorForm({ config, setConfig, field }: { config: any; setConfig: (c: any) => void; field: (k: any) => any }) {
  return (
    <div className="space-y-4 pt-4">
      <div>
        <FieldLabel>Tone of Voice</FieldLabel>
        <select {...field("tone_of_voice")} className={inputCls()}>
          <option value="">Select a tone...</option>
          {TONE_OPTIONS.map((t) => (
            <option key={t} value={t.toLowerCase()}>{t}</option>
          ))}
        </select>
      </div>
      <div>
        <FieldLabel>What does your business do?</FieldLabel>
        <textarea
          rows={3}
          {...field("what_we_do")}
          placeholder="e.g. We provide cloud-based HR software for small and mid-sized businesses..."
          className={`${inputCls()} resize-none`}
        />
      </div>
      <div>
        <FieldLabel>Target Audience</FieldLabel>
        <textarea
          rows={2}
          {...field("target_audience")}
          placeholder="e.g. Small business owners and HR managers..."
          className={`${inputCls()} resize-none`}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FieldLabel>Brand Values</FieldLabel>
          <textarea
            rows={3}
            {...field("brand_values")}
            placeholder="e.g. Transparency, innovation, customer-first..."
            className={`${inputCls()} resize-none`}
          />
        </div>
        <div>
          <FieldLabel>What Makes You Unique</FieldLabel>
          <textarea
            rows={3}
            {...field("unique_selling_proposition")}
            placeholder="e.g. Only platform with built-in compliance automation..."
            className={`${inputCls()} resize-none`}
          />
        </div>
      </div>
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">Proactive Chat Triggers</div>
            <div className="text-[11px] text-gray-500">Pop open the chat automatically to engage visitors.</div>
          </div>
        </div>
        <div className="space-y-3">
          <input
            type="text"
            {...field("proactive_message")}
            placeholder="e.g. Hi there! Can I help you find anything?"
            className={inputCls()}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Delay (seconds)</FieldLabel>
              <input
                type="number"
                min={0}
                value={config.proactive_delay ?? 0}
                onChange={(e) => setConfig({ ...config, proactive_delay: parseInt(e.target.value) || 0 })}
                className={inputCls()}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="exit-intent"
                type="checkbox"
                checked={config.proactive_exit_intent}
                onChange={(e) => setConfig({ ...config, proactive_exit_intent: e.target.checked })}
                className="w-4 h-4 accent-violet-600 cursor-pointer"
              />
              <label htmlFor="exit-intent" className="text-xs font-semibold text-gray-700 cursor-pointer">
                Trigger on Exit Intent
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── 3. Lead Capture ───────────── */

function LeadCaptureForm({ config, setConfig, field }: { config: any; setConfig: (c: any) => void; field: (k: any) => any }) {
  return (
    <div className="space-y-4 pt-4">
      <div>
        <FieldLabel>Booking Link (Calendly / Cal.com)</FieldLabel>
        <input type="url" {...field("calendly_url")} placeholder="https://calendly.com/your-name" className={inputCls()} />
        <p className="text-[11px] text-gray-500 mt-1.5">Offered to visitors who want to book a meeting.</p>
      </div>
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-gray-900">Conversation Continuity</div>
            <div className="text-[11px] text-gray-500">Email visitors when you reply and they're offline.</div>
          </div>
          <input
            type="checkbox"
            checked={config.email_followup_enabled}
            onChange={(e) => setConfig({ ...config, email_followup_enabled: e.target.checked })}
            className="w-4 h-4 accent-violet-600 cursor-pointer"
          />
        </div>
        {config.email_followup_enabled && (
          <div>
            <FieldLabel>Email Subject</FieldLabel>
            <input
              type="text"
              {...field("email_followup_subject")}
              placeholder="e.g. You have a new message from our team"
              className={inputCls()}
            />
            <p className="text-[11px] text-gray-500 mt-1.5">Leave blank to use default: "New message from [Bot Name]"</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────── 4. Advanced Settings (AI model + contact) ───────────── */

function AdvancedForm({ config, setConfig, field }: { config: any; setConfig: (c: any) => void; field: (k: any) => any }) {
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FieldLabel>AI Provider</FieldLabel>
          <select
            value={config.ai_provider}
            onChange={(e) => {
              const newProvider = e.target.value;
              let defaultModel = "gpt-4o-mini";
              if (newProvider === "anthropic") defaultModel = "claude-haiku-4-5-20251001";
              if (newProvider === "groq") defaultModel = "llama-3.3-70b-versatile";
              if (newProvider === "gemini") defaultModel = "gemini-2.0-flash";
              if (newProvider === "grok") defaultModel = "grok-3-mini";
              setConfig({ ...config, ai_provider: newProvider, ai_model: defaultModel });
            }}
            className={inputCls()}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="gemini">Google Gemini</option>
            <option value="groq">Groq (Llama)</option>
            <option value="grok">xAI (Grok)</option>
          </select>
        </div>
        <div>
          <FieldLabel>Model</FieldLabel>
          <select {...field("ai_model")} className={inputCls()}>
            {config.ai_provider === "openai" && (
              <>
                <option value="gpt-4o-mini">GPT-4o Mini (Fast)</option>
                <option value="gpt-4o">GPT-4o (Powerful)</option>
              </>
            )}
            {config.ai_provider === "anthropic" && (
              <>
                <option value="claude-haiku-4-5-20251001">Claude 3.5 Haiku (Fast)</option>
                <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Powerful)</option>
              </>
            )}
            {config.ai_provider === "gemini" && (
              <>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast)</option>
                <option value="gemini-2.0-pro-exp-02-05">Gemini 2.0 Pro (Powerful)</option>
              </>
            )}
            {config.ai_provider === "groq" && (
              <>
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Fast)</option>
                <option value="mixtral-8x7b-32768">Mixtral 8x7b (Fast)</option>
              </>
            )}
            {config.ai_provider === "grok" && (
              <>
                <option value="grok-3-mini">Grok 3 Mini (Fast)</option>
                <option value="grok-3">Grok 3 (Powerful)</option>
              </>
            )}
          </select>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <div className="text-sm font-semibold text-gray-900 mb-3">Company Information</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <FieldLabel>Company Email</FieldLabel>
            <input type="email" {...field("company_email")} placeholder="support@yourcompany.com" className={inputCls()} />
          </div>
          <div>
            <FieldLabel>Phone Number</FieldLabel>
            <input type="text" {...field("company_phone")} placeholder="+1 (555) 000-0000" className={inputCls()} />
          </div>
          <div>
            <FieldLabel>Website</FieldLabel>
            <input type="url" {...field("company_website")} placeholder="https://yourcompany.com" className={inputCls()} />
          </div>
          <div>
            <FieldLabel>Business Hours</FieldLabel>
            <input type="text" {...field("business_hours")} placeholder="Mon-Fri 9AM-6PM EST" className={inputCls()} />
          </div>
        </div>
        <div className="mt-3">
          <FieldLabel>Company Address</FieldLabel>
          <input type="text" {...field("company_address")} placeholder="123 Main St, City, State, ZIP" className={inputCls()} />
        </div>
      </div>
    </div>
  );
}

/* ───────────── 5. Customization (custom system prompt) ───────────── */

function CustomForm({ config, field }: { config: any; field: (k: any) => any }) {
  return (
    <div className="space-y-3 pt-4">
      <div className="flex items-start gap-2 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
        <span className="material-symbols-outlined text-violet-600 mt-0.5" style={{ fontSize: "16px" }}>auto_awesome</span>
        <p className="text-[11px] text-violet-700 leading-relaxed">
          Override the auto-generated Brand Voice prompt with a fully custom system prompt. Leave blank to keep using Brand Voice fields.
        </p>
      </div>
      <FieldLabel>Custom System Prompt</FieldLabel>
      <textarea
        rows={8}
        {...field("system_prompt")}
        placeholder="e.g. You are a helpful customer support agent for Acme Inc. Always be concise and friendly."
        className={`${inputCls()} resize-none font-mono text-[12px]`}
      />
    </div>
  );
}

/* ───────────── Live Preview ───────────── */

function ChatPreview({ config, device }: { config: any; device: DeviceMode }) {
  const widths = { mobile: 320, tablet: 380, desktop: 400 };
  const heights = { mobile: 560, tablet: 540, desktop: 520 };
  const w = widths[device];
  const h = heights[device];

  const isDark = config.theme === "dark";
  const bubbleBg = isDark ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900";
  const containerBg = isDark ? "bg-gray-900" : "bg-white";
  const footerBg = isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100";
  const inputBg = isDark ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-gray-50 border-gray-200 text-gray-900";

  return (
    <div 
      className="p-1.5 bg-[#0F172A] rounded-[34px] shadow-2xl ring-1 ring-white/10"
      style={{ width: w + 12, height: h + 12 }}
    >
      <div
        className={`relative ${containerBg} rounded-[26px] overflow-hidden flex flex-col h-full w-full`}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between text-white shrink-0" style={{ backgroundColor: config.primary_color }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center font-bold text-sm shadow-sm" style={{ color: config.primary_color }}>
              {(config.bot_name || "A").charAt(0).toUpperCase()}
            </div>
            <div className="text-[15px] font-bold tracking-tight">{config.bot_name || "Assistant"}</div>
          </div>
          <div className="flex items-center gap-3 opacity-90">
            <span className="material-symbols-outlined cursor-pointer hover:opacity-100 transition-opacity" style={{ fontSize: "20px" }}>more_horiz</span>
            <span className="material-symbols-outlined cursor-pointer hover:opacity-100 transition-opacity" style={{ fontSize: "20px" }}>close</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto bg-white">
          {(config.welcome_message || "Hi! How can I help you today?")
            .split("\n")
            .filter((l: string) => l.trim().length > 0)
            .map((line: string, i: number) => (
              <div
                key={`w-${i}`}
                className={`py-2.5 px-3.5 rounded-2xl rounded-bl-sm max-w-[85%] self-start text-[13px] leading-relaxed ${bubbleBg}`}
              >
                {line}
              </div>
            ))}

          {config.suggested_questions.filter((q: string) => q.trim().length > 0).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-auto pt-2 justify-end">
              {config.suggested_questions.filter((q: string) => q.trim().length > 0).map((q: string, i: number) => (
                <div
                  key={i}
                  className="px-2.5 py-1 text-[11px] bg-white border border-gray-200 text-gray-700 rounded-full"
                >
                  {q}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`shrink-0 border-t ${footerBg} pb-3`}>
          <div className="flex justify-center pt-2 pb-1.5">
            <div className="px-2.5 py-0.5 rounded bg-gray-100 text-[9px] text-gray-500 font-medium tracking-tight">
              Powered by ChatBot AI
            </div>
          </div>
          <div className="px-4">
            <div className={`flex items-center gap-2 bg-white border border-gray-200 rounded-full pl-4 pr-1.5 py-1.5 shadow-sm`}>
              <input 
                className="bg-transparent outline-none flex-1 text-[13px] text-gray-500" 
                disabled 
                placeholder="Ask me anything..." 
                type="text" 
              />
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95"
                style={{ backgroundColor: config.primary_color }}
              >
                <span className="material-symbols-outlined text-white" style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}>send</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────── Right rail cards ───────────── */

function ProTipsCard() {
  const tips = [
    { icon: "waving_hand", text: "Add a friendly welcome message" },
    { icon: "person_add", text: "Enable lead capture to grow your list" },
    { icon: "task_alt", text: "Set clear fallback responses" },
    { icon: "bolt", text: "Test your bot before publishing" },
  ];
  return (
    <div className="bg-violet-50/60 border border-violet-100 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-violet-600" style={{ fontSize: "18px", fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
        <h3 className="text-sm font-bold text-violet-700">Pro Tips</h3>
      </div>
      <p className="text-[11px] text-gray-600 leading-relaxed mb-3">
        A well-configured bot has higher engagement and better conversions.
      </p>
      <ul className="space-y-2">
        {tips.map((t) => (
          <li key={t.text} className="flex items-center gap-2 text-[12px] text-gray-700">
            <span className="w-6 h-6 bg-white border border-violet-100 rounded-md flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-violet-600" style={{ fontSize: "14px" }}>{t.icon}</span>
            </span>
            {t.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuggestedQuestionsCard({ config, setConfig }: { config: any; setConfig: (c: any) => void }) {
  function update(idx: number, value: string) {
    const next = [...config.suggested_questions];
    next[idx] = value;
    setConfig({ ...config, suggested_questions: next });
  }
  function remove(idx: number) {
    setConfig({ ...config, suggested_questions: config.suggested_questions.filter((_: string, i: number) => i !== idx) });
  }
  function add() {
    setConfig({ ...config, suggested_questions: [...config.suggested_questions, ""] });
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= config.suggested_questions.length) return;
    const next = [...config.suggested_questions];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setConfig({ ...config, suggested_questions: next });
  }

  return (
    <div className="bg-white border border-gray-200/70 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900">Suggested Questions</h3>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
          Add Question
        </button>
      </div>
      <p className="text-[11px] text-gray-500 mb-3">Add questions to guide conversations.</p>
      <div className="space-y-2">
        {config.suggested_questions.length === 0 && (
          <div className="text-center py-4 border border-dashed border-gray-200 rounded-lg">
            <p className="text-[11px] text-gray-400">No questions yet.</p>
          </div>
        )}
        {config.suggested_questions.map((q: string, i: number) => (
          <div
            key={i}
            className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg pr-1 pl-2 hover:border-gray-300 transition-colors"
          >
            <input
              type="text"
              value={q}
              onChange={(e) => update(i, e.target.value)}
              placeholder="e.g. Do you offer a free trial?"
              className="flex-1 py-2 text-[12px] text-gray-800 outline-none bg-transparent"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-1 text-gray-300 hover:text-red-500 transition-colors"
              title="Remove"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>close</span>
            </button>
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                className="p-0.5 text-gray-300 hover:text-gray-700 leading-none"
                title="Move up"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>arrow_drop_up</span>
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                className="p-0.5 text-gray-300 hover:text-gray-700 leading-none"
                title="Move down"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "12px" }}>arrow_drop_down</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewBotCard() {
  return (
    <div className="bg-white border border-gray-200/70 rounded-2xl p-4">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-violet-600" style={{ fontSize: "18px" }}>preview</span>
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-violet-700">Preview Your Bot</div>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
            See how your bot looks and interacts before it goes live.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700"
        >
          Open Full Preview
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
        </a>
      </div>
    </div>
  );
}

function NeedHelpCard() {
  return (
    <div className="bg-white border border-gray-200/70 rounded-2xl p-4">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-gray-600" style={{ fontSize: "18px" }}>help</span>
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-gray-900">Need Help?</div>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
            Check our documentation or contact our support team.
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 hover:text-gray-900"
        >
          View Documentation
          <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>open_in_new</span>
        </a>
      </div>
    </div>
  );
}
