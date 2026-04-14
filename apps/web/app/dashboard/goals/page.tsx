"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface CustomQuestion {
  question: string;
  field: string;
  required: boolean;
}

interface LeadConfig {
  enabled: boolean;
  collect_name: boolean;
  collect_email: boolean;
  collect_phone: boolean;
  collect_address: boolean;
  custom_questions: CustomQuestion[];
  skip_if_filled: boolean;
  trigger_after: number;
}

const DEFAULT_CONFIG: LeadConfig = {
  enabled: false,
  collect_name: true,
  collect_email: true,
  collect_phone: false,
  collect_address: false,
  custom_questions: [],
  skip_if_filled: true,
  trigger_after: 1,
};

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="font-bold text-gray-900 text-sm">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ${checked ? "bg-orange-500" : "bg-gray-200"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors shrink-0 ${checked ? "bg-orange-500 border-orange-500" : "border-gray-300 group-hover:border-orange-400"}`}
      >
        {checked && <span className="material-symbols-outlined text-white" style={{ fontSize: "14px" }}>check</span>}
      </div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  );
}

export default function GoalsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<LeadConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getLeadConfig()
      .then((data) => setConfig({ ...DEFAULT_CONFIG, ...data }))
      .catch((err: unknown) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          router.push("/login");
        }
        // Other errors (network, 500): stay on page with default config
      })
      .finally(() => setLoading(false));
  }, []);

  function field<K extends keyof LeadConfig>(key: K) {
    return (value: LeadConfig[K]) => setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function addCustomQuestion() {
    setConfig((prev) => ({
      ...prev,
      custom_questions: [...prev.custom_questions, { question: "", field: "", required: false }],
    }));
  }

  function updateQuestion(i: number, patch: Partial<CustomQuestion>) {
    setConfig((prev) => ({
      ...prev,
      custom_questions: prev.custom_questions.map((q, idx) => idx === i ? { ...q, ...patch } : q),
    }));
  }

  function removeQuestion(i: number) {
    setConfig((prev) => ({
      ...prev,
      custom_questions: prev.custom_questions.filter((_, idx) => idx !== i),
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateLeadConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-gray-400 text-sm font-bold py-20 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-2xl" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="mb-10">
        <h1 className="text-5xl font-extrabold tracking-tighter text-gray-900 leading-tight mb-4">
          Bot <span className="text-orange-600 italic">Goals.</span>
        </h1>
        <p className="text-lg text-gray-500 font-medium leading-relaxed">
          Configure what information your bot collects from visitors during conversation.
        </p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Enable / Disable */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <Toggle
            checked={config.enabled}
            onChange={field("enabled")}
            label="Enable Lead Collection"
            description="When on, the bot will naturally ask visitors for their contact information."
          />
        </div>

        {/* Fields to collect */}
        <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-5 transition-opacity ${config.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <div>
            <h3 className="font-extrabold text-gray-900 mb-1">Contact Fields</h3>
            <p className="text-xs text-gray-400">Select which fields the bot should collect.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Checkbox checked={config.collect_name} onChange={field("collect_name")} label="Full Name" />
            <Checkbox checked={config.collect_email} onChange={field("collect_email")} label="Email Address" />
            <Checkbox checked={config.collect_phone} onChange={field("collect_phone")} label="Phone Number" />
            <Checkbox checked={config.collect_address} onChange={field("collect_address")} label="Mailing Address" />
          </div>
        </div>

        {/* Custom questions */}
        <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-4 transition-opacity ${config.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-gray-900 mb-1">Custom Questions</h3>
              <p className="text-xs text-gray-400">Ask anything beyond the standard fields.</p>
            </div>
            <button
              type="button"
              onClick={addCustomQuestion}
              className="flex items-center gap-1.5 text-sm text-orange-600 font-bold hover:text-orange-700 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add_circle</span>
              Add question
            </button>
          </div>
          {config.custom_questions.length === 0 ? (
            <p className="text-sm text-gray-300 italic">No custom questions yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {config.custom_questions.map((q, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Question {i + 1}</span>
                    <button type="button" onClick={() => removeQuestion(i)} className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>delete</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. What's your company size?"
                    value={q.question}
                    onChange={(e) => updateQuestion(i, { question: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  />
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Field name (e.g. company_size)"
                      value={q.field}
                      onChange={(e) => updateQuestion(i, { field: e.target.value })}
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    />
                    <Checkbox
                      checked={q.required}
                      onChange={(v) => updateQuestion(i, { required: v })}
                      label="Required"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Behaviour settings */}
        <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col gap-5 transition-opacity ${config.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <h3 className="font-extrabold text-gray-900">Behaviour</h3>
          <Toggle
            checked={config.skip_if_filled}
            onChange={field("skip_if_filled")}
            label="Skip if already known"
            description="Don't re-ask for info the visitor has already provided."
          />
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Start collecting after
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={10}
                value={config.trigger_after}
                onChange={(e) => field("trigger_after")(Number(e.target.value))}
                className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
              <span className="text-sm text-gray-500 font-medium">bot message(s)</span>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3.5 bg-gray-900 text-white rounded-2xl font-bold text-sm hover:opacity-90 disabled:opacity-60 transition-opacity shadow-lg"
          >
            {saving ? "Saving..." : "Save Goals"}
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-green-600 font-bold text-sm">
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>check_circle</span>
              Saved
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
