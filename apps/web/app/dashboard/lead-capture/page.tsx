"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

/* ─── Types ─── */
interface CustomQuestion { question: string; field: string; required: boolean; }
interface LeadConfig {
  enabled: boolean;
  collect_name: boolean;
  collect_email: boolean;
  collect_phone: boolean;
  collect_company: boolean;
  collect_job_title: boolean;
  collect_address: boolean;
  custom_questions: CustomQuestion[];
  skip_if_filled: boolean;
  trigger_after: number;
  display_style: "inline" | "popup" | "full_page";
  collect_timing: string;
  required_field_label: string;
}

const DEFAULT: LeadConfig = {
  enabled: true,
  collect_name: true,
  collect_email: true,
  collect_phone: true,
  collect_company: true,
  collect_job_title: true,
  collect_address: false,
  custom_questions: [],
  skip_if_filled: true,
  trigger_after: 2,
  display_style: "inline",
  collect_timing: "after_specific_message",
  required_field_label: "* Required",
};

type Tab = "form" | "success" | "handoff" | "integrations";

/* ─── Field descriptor ─── */
type FieldId = "name" | "email" | "phone" | "company" | "job_title" | string; // custom_0, custom_1…

const STANDARD_FIELDS: { id: FieldId; icon: string; label: string; configKey: keyof LeadConfig }[] = [
  { id: "name",      icon: "person",    label: "Full Name",     configKey: "collect_name" },
  { id: "email",     icon: "mail",      label: "Email Address", configKey: "collect_email" },
  { id: "phone",     icon: "call",      label: "Phone Number",  configKey: "collect_phone" },
  { id: "company",   icon: "apartment", label: "Company Name",  configKey: "collect_company" },
  { id: "job_title", icon: "badge",     label: "Job Title",     configKey: "collect_job_title" },
  { id: "address",   icon: "location_on", label: "Address",       configKey: "collect_address" },
];

/* ─── Toggle ─── */
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0 ${checked ? "bg-violet-600" : "bg-gray-200"}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

/* ─── Preview field ─── */
function PreviewField({ label, placeholder, required }: { label: string; placeholder: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        disabled
        placeholder={placeholder}
        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 placeholder:text-gray-300"
      />
    </div>
  );
}

/* ─── Main Page ─── */
export default function LeadCapturePage() {
  const router = useRouter();
  const [config, setConfig] = useState<LeadConfig>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("form");

  // Ordered list of field IDs currently in the form
  const [fieldOrder, setFieldOrder] = useState<FieldId[]>(["name", "email", "phone", "company", "job_title"]);
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    api.getLeadConfig()
      .then((d) => {
        const merged = { ...DEFAULT, ...d };
        setConfig(merged);
        // Rebuild fieldOrder from merged config
        const initial: FieldId[] = STANDARD_FIELDS
          .filter((f) => merged[f.configKey])
          .map((f) => f.id);
        // append custom questions
        merged.custom_questions.forEach((_: CustomQuestion, i: number) => initial.push(`custom_${i}`));
        setFieldOrder(initial);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) router.push("/login");
      })
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof LeadConfig>(key: K, val: LeadConfig[K]) {
    setConfig((p) => ({ ...p, [key]: val }));
  }

  // Toggle a standard field on/off and sync fieldOrder
  function toggleStandardField(fieldId: FieldId, configKey: keyof LeadConfig, enabled: boolean) {
    setConfig((p) => ({ ...p, [configKey]: enabled }));
    setFieldOrder((prev) =>
      enabled ? [...prev, fieldId] : prev.filter((id) => id !== fieldId)
    );
  }

  function addCustomQuestion() {
    setConfig((p) => {
      const newIdx = p.custom_questions.length;
      const fieldKey = `custom_${newIdx}`;
      setFieldOrder((prev) => {
        if (prev.includes(fieldKey)) return prev;
        return [...prev, fieldKey];
      });
      return { 
        ...p, 
        custom_questions: [
          ...p.custom_questions, 
          { question: "", field: fieldKey, required: false }
        ] 
      };
    });
  }

  function updateQ(i: number, patch: Partial<CustomQuestion>) {
    setConfig((p) => ({ ...p, custom_questions: p.custom_questions.map((q, idx) => idx === i ? { ...q, ...patch } : q) }));
  }

  function removeQ(customId: string) {
    const idx = parseInt(customId.replace("custom_", ""), 10);
    setConfig((p) => {
      const next = p.custom_questions.filter((_, i) => i !== idx);
      // Re-key remaining custom fields in fieldOrder
      setFieldOrder((prev) => {
        const without = prev.filter((id) => id !== customId);
        // Renumber custom_N entries that come after the removed one
        return without.map((id) => {
          if (!id.startsWith("custom_")) return id;
          const n = parseInt(id.replace("custom_", ""), 10);
          return n > idx ? `custom_${n - 1}` : id;
        });
      });
      return { ...p, custom_questions: next };
    });
  }

  /* ── Drag handlers ── */
  function onDragStart(index: number) {
    dragIndex.current = index;
  }

  function onDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const from = dragIndex.current;
    const to = dragOverIndex;
    if (from === null || to === null || from === to) {
      dragIndex.current = null;
      setDragOverIndex(null);
      return;
    }
    setFieldOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  function onDragEnd() {
    dragIndex.current = null;
    setDragOverIndex(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Basic validation: Custom questions must have a question text
      if (config.custom_questions.some(q => !q.question.trim())) {
        throw new Error("Please fill in the Question / Label for all custom fields.");
      }

      // Sync custom_questions array with the visual sequence in fieldOrder
      // and ensure 'field' keys match the new indices to avoid backend confusion
      const orderedCustom = fieldOrder
        .filter(id => id.startsWith("custom_"))
        .map((id, index) => {
          const originalIdx = parseInt(id.replace("custom_", ""), 10);
          const q = config.custom_questions[originalIdx];
          return {
            ...q,
            field: `custom_${index}` // Re-key to match new array position
          };
        });

      const updatedConfig = { ...config, custom_questions: orderedCustom };
      await api.updateLeadConfig(updatedConfig);

      // Reset fieldOrder mapping so they always use sequential custom_0, custom_1 etc.
      setFieldOrder(prev => {
        let c = 0;
        return prev.map(id => id.startsWith("custom_") ? `custom_${c++}` : id);
      });
      setConfig(updatedConfig);

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message || "Failed to save settings. Please check all fields.");
      setTimeout(() => setError(null), 5000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "form", label: "Form Builder" },
    { id: "success", label: "Success Message" },
    { id: "handoff", label: "Handoff Settings" },
    { id: "integrations", label: "Integrations" },
  ];

  const inputCls = "w-full bg-white border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 rounded-lg px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-all";

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Success/Error Toasts */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3">
        {saved && (
          <div className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-full shadow-2xl animate-in slide-in-from-bottom-4">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>check_circle</span>
            <span className="text-sm font-bold">Settings saved successfully</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-600 text-white px-5 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>error</span>
            <span className="text-sm font-bold">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-70 transition-opacity">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
        <span className="hover:text-gray-600 cursor-pointer">Home</span>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
        <span className="text-gray-600 font-medium">Lead Capture</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-violet-600" style={{ fontSize: 28, fontVariationSettings: "'FILL' 1" }}>
              contacts
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lead Capture</h1>
            <p className="text-sm text-gray-500 mt-0.5">Build and customize the lead capture form and handoff experience.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>menu_book</span>
            View Guide
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md shadow-violet-900/20 transition-colors disabled:opacity-60 ${saved ? "bg-emerald-600" : "bg-violet-600 hover:bg-violet-500"}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
            {saved ? "Saved!" : saving ? "Saving..." : "Save Capture Settings"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === t.id ? "border-violet-600 text-violet-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Form Builder */}
      {tab === "form" && (
        <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_300px] gap-5">
          {/* ── Left: Form Fields ── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-1">Form Fields</h2>
            <p className="text-xs text-gray-400 mb-4">Drag the handle to reorder fields.</p>
            <div className="space-y-2">
              {fieldOrder.map((fieldId, index) => {
                const std = STANDARD_FIELDS.find((f) => f.id === fieldId);
                const isOver = dragOverIndex === index;

                if (std) {
                  /* ── Standard field row ── */
                  return (
                    <div
                      key={fieldId}
                      draggable
                      onDragStart={() => onDragStart(index)}
                      onDragOver={(e) => onDragOver(e, index)}
                      onDrop={onDrop}
                      onDragEnd={onDragEnd}
                      className={`flex items-center justify-between px-4 py-3 bg-white border rounded-xl transition-all cursor-grab select-none ${
                        isOver
                          ? "border-violet-400 bg-violet-50 shadow-md scale-[1.01]"
                          : "border-gray-200 hover:border-violet-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-gray-400" style={{ fontSize: 18 }}>{std.icon}</span>
                        <span className="text-sm font-medium text-gray-700">{std.label}</span>
                      </div>
                      <span className="material-symbols-outlined text-gray-300 cursor-grab" style={{ fontSize: 18 }}>drag_indicator</span>
                    </div>
                  );
                }

                /* ── Custom question card ── */
                const customIdx = parseInt(fieldId.replace("custom_", ""), 10);
                const q = config.custom_questions[customIdx];
                if (!q) return null;
                return (
                  <div
                    key={fieldId}
                    className={`border rounded-xl overflow-hidden transition-all ${
                      isOver ? "border-violet-400 shadow-md scale-[1.01]" : "border-violet-200 bg-violet-50/40"
                    }`}
                  >
                    {/* Draggable header */}
                    <div
                      draggable
                      onDragStart={() => onDragStart(index)}
                      onDragOver={(e) => onDragOver(e, index)}
                      onDrop={onDrop}
                      onDragEnd={onDragEnd}
                      className="flex items-center justify-between px-3 py-2 bg-violet-50 border-b border-violet-100 cursor-grab select-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-violet-300" style={{ fontSize: 16 }}>drag_indicator</span>
                        <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 16 }}>chat_bubble</span>
                        <span className="text-xs font-bold text-violet-600 uppercase tracking-wide">Custom Field {customIdx + 1}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeQ(fieldId)}
                        className="text-violet-300 hover:text-red-400 transition-colors"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                      </button>
                    </div>
                    {/* Editable body */}
                    <div className="px-3 py-3 space-y-2" onDragOver={(e) => e.preventDefault()}>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Question / Label</label>
                        <input
                          type="text"
                          value={q.question}
                          onChange={(e) => updateQ(customIdx, { question: e.target.value })}
                          placeholder="e.g. What is your company size?"
                          className="w-full bg-white border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Field Key (optional)</label>
                        <input
                          type="text"
                          value={q.field}
                          onChange={(e) => updateQ(customIdx, { field: e.target.value })}
                          placeholder="e.g. company_size"
                          className="w-full bg-white border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 rounded-lg px-3 py-2 text-sm text-gray-600 font-mono outline-none transition-all"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => updateQ(customIdx, { required: e.target.checked })}
                          className="w-4 h-4 accent-violet-600"
                        />
                        <span className="text-xs font-semibold text-gray-600">Mark as required</span>
                      </label>

                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                          {saving ? (
                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                          )}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {fieldOrder.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                  <span className="material-symbols-outlined text-gray-300" style={{ fontSize: 32 }}>list_alt</span>
                  <p className="text-xs text-gray-400 mt-2">Enable fields on the right to add them here.</p>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={addCustomQuestion}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-violet-400 hover:text-violet-600 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
              Add Custom Field
            </button>
          </div>

          {/* ── Center: Form Preview ── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-1">Form Preview</h2>
            <p className="text-xs text-gray-400 mb-5">This is how your lead capture form will appear to visitors.</p>

            {/* Chat widget preview */}
            <div className="max-w-[360px] mx-auto rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
              {/* Widget header */}
              <div className="flex items-center justify-between px-4 py-3 bg-violet-600">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                  </div>
                  <div>
                    <div className="text-white text-sm font-bold">AI Assistant</div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-violet-200 text-[10px]">Online</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-white/70">
                  <span className="material-symbols-outlined cursor-pointer" style={{ fontSize: 18 }}>more_horiz</span>
                  <span className="material-symbols-outlined cursor-pointer" style={{ fontSize: 18 }}>close</span>
                </div>
              </div>

              {/* Widget body */}
              <div className="bg-gray-50 px-4 py-4 space-y-3">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-[13px] text-gray-700 max-w-[85%]">
                  Before we continue, may I have a few details?
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
                  {fieldOrder.map((fieldId) => {
                    const std = STANDARD_FIELDS.find((f) => f.id === fieldId);
                    if (std) {
                      const placeholders: Record<string, string> = {
                        name: "Enter your full name",
                        email: "Enter your email",
                        phone: "Enter your phone number",
                        company: "Enter your company name",
                        job_title: "Enter your job title",
                      };
                      const isRequired: Record<string, boolean> = {
                        name: true,
                        email: true,
                        phone: false,
                        company: false,
                        job_title: false,
                      };
                      return (
                        <PreviewField
                          key={fieldId}
                          label={std.label}
                          placeholder={placeholders[fieldId] || "Enter details..."}
                          required={isRequired[fieldId]}
                        />
                      );
                    }

                    const customIdx = parseInt(fieldId.replace("custom_", ""), 10);
                    const q = config.custom_questions[customIdx];
                    if (!q || !q.question) return null;
                    return (
                      <PreviewField
                        key={fieldId}
                        label={q.question}
                        placeholder="Type your answer..."
                        required={q.required}
                      />
                    );
                  })}
                  {fieldOrder.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-2">Enable fields on the left to preview them here.</p>
                  )}
                  <button className="w-full py-2.5 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-500 transition-colors">
                    Submit
                  </button>
                </div>

                <div className="flex justify-center pt-1">
                  <span className="text-[10px] text-gray-400">⚡ Powered by ChatBot AI</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Form Settings ── */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-1">Form Settings</h2>
              <p className="text-xs text-gray-400 mb-5">Customize how the form behaves and appears.</p>

              {/* Display Style */}
              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-700 mb-2">Display Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { val: "inline", label: "Inline", icon: "web_asset" },
                    { val: "popup", label: "Popup", icon: "open_in_new" },
                    { val: "full_page", label: "Full Page", icon: "fullscreen" },
                  ] as const).map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => set("display_style", s.val)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[11px] font-semibold transition-all ${config.display_style === s.val ? "border-violet-500 bg-violet-50 text-violet-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{s.icon}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Collect Information */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Collect Information</label>
                <p className="text-[11px] text-gray-400 mb-2">Choose when to show the form.</p>
                <select
                  value={config.collect_timing}
                  onChange={(e) => set("collect_timing", e.target.value)}
                  className={inputCls}
                >
                  <option value="after_specific_message">After specific bot message</option>
                  <option value="immediately">Immediately on open</option>
                  <option value="after_first_message">After first user message</option>
                  <option value="on_exit">On exit intent</option>
                </select>
              </div>

              {/* Collect After */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-2">Collect After</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={config.trigger_after}
                    onChange={(e) => set("trigger_after", Number(e.target.value))}
                    className="w-20 border border-gray-200 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/15 rounded-lg px-3 py-2.5 text-sm text-gray-900 outline-none text-center"
                  />
                  <span className="text-sm text-gray-500">bot message(s)</span>
                </div>
              </div>

              {/* Required Field Label */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Required Field Label</label>
                <input
                  type="text"
                  value={config.required_field_label}
                  onChange={(e) => set("required_field_label", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            {/* Fields to Collect */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-4">Fields to Collect</h2>
              <div className="space-y-3">
                {STANDARD_FIELDS.map(({ id, label, configKey }) => (
                  <div key={id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{label}</span>
                    <Toggle
                      checked={!!config[configKey as keyof LeadConfig]}
                      onChange={(v) => toggleStandardField(id, configKey as keyof LeadConfig, v)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Pro Tips */}
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-violet-600" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
                <h3 className="text-sm font-bold text-violet-700">Pro Tips</h3>
              </div>
              <ul className="space-y-3">
                {[
                  { icon: "checklist", title: "Keep your form short", desc: "Ask only for essential information to increase conversions." },
                  { icon: "schedule", title: "Use smart timing", desc: "Show the form after building trust in the conversation." },
                  { icon: "tune", title: "Personalize questions", desc: "Adapt questions based on the user's responses." },
                ].map((tip) => (
                  <li key={tip.title} className="flex items-start gap-2.5">
                    <div className="w-6 h-6 bg-white border border-violet-100 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-violet-600" style={{ fontSize: 14 }}>{tip.icon}</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-800">{tip.title}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{tip.desc}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Success Message */}
      {tab === "success" && (
        <div className="max-w-xl">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-900">Success Message</h2>
            <p className="text-xs text-gray-400">Shown to visitors after they submit the form.</p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Heading</label>
              <input type="text" defaultValue="Thanks! We'll be in touch soon." className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Body</label>
              <textarea rows={4} defaultValue="One of our team members will reach out to you shortly." className={`${inputCls} resize-none`} />
            </div>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
              {saved ? "Saved!" : saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Handoff Settings */}
      {tab === "handoff" && (
        <div className="max-w-xl">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-bold text-gray-900">Handoff Settings</h2>
            <p className="text-xs text-gray-400">Configure how leads are passed to your team after form submission.</p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Notification Email</label>
              <input type="email" placeholder="team@yourcompany.com" className={inputCls} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-gray-700">Send email notification</p>
                <p className="text-xs text-gray-400 mt-0.5">Email your team when a lead submits the form.</p>
              </div>
              <Toggle checked={true} onChange={() => {}} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-gray-700">Assign to agent automatically</p>
                <p className="text-xs text-gray-400 mt-0.5">Route to the next available agent.</p>
              </div>
              <Toggle checked={false} onChange={() => {}} />
            </div>
            <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60">
              {saved ? "Saved!" : saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Integrations */}
      {tab === "integrations" && (
        <div className="max-w-2xl">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-900 mb-1">Integrations</h2>
            <p className="text-xs text-gray-400 mb-5">Connect your lead capture form to your CRM or marketing tools.</p>
            <div className="space-y-3">
              {[
                { name: "HubSpot", desc: "Sync leads directly to your HubSpot CRM.", icon: "hub", connected: false },
                { name: "Salesforce", desc: "Push leads to Salesforce automatically.", icon: "cloud", connected: false },
                { name: "Mailchimp", desc: "Add leads to your Mailchimp audience.", icon: "mail", connected: false },
                { name: "Zapier", desc: "Connect to 5,000+ apps via Zapier.", icon: "bolt", connected: false },
              ].map((intg) => (
                <div key={intg.name} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-gray-600" style={{ fontSize: 20 }}>{intg.icon}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{intg.name}</div>
                      <div className="text-xs text-gray-400">{intg.desc}</div>
                    </div>
                  </div>
                  <button className="px-3.5 py-1.5 text-xs font-semibold text-violet-600 border border-violet-200 rounded-lg hover:bg-violet-50 transition-colors">
                    Connect
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
