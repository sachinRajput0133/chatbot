"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

export default function CustomizePage() {
  const router = useRouter();
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
      .then((c) => setConfig({ ...config, ...c }))
      .catch(() => router.push("/login"));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateWidgetConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Customize Bot</h1>
      <p className="text-sm text-gray-500 mb-6">Personalize how your chatbot looks and behaves.</p>

      <div className="grid grid-cols-2 gap-6">
        {/* Form */}
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium">Bot Name</label>
            <input
              type="text"
              value={config.bot_name}
              onChange={(e) => setConfig({ ...config, bot_name: e.target.value })}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Brand Color</label>
            <div className="flex items-center gap-3 mt-1">
              <input type="color" value={config.primary_color} onChange={(e) => setConfig({ ...config, primary_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer" />
              <input type="text" value={config.primary_color} onChange={(e) => setConfig({ ...config, primary_color: e.target.value })} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Welcome Message</label>
            <input
              type="text"
              value={config.welcome_message}
              onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Position</label>
            <select
              value={config.position}
              onChange={(e) => setConfig({ ...config, position: e.target.value })}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Custom System Prompt (optional)</label>
            <textarea
              rows={3}
              value={config.system_prompt}
              onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
              placeholder="e.g. Always respond in Spanish. Be very brief."
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`py-2.5 rounded-lg font-semibold transition ${saved ? "bg-green-600 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"} disabled:opacity-60`}
          >
            {saved ? "Saved!" : loading ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* Live preview */}
        <div className="relative bg-gray-100 rounded-xl p-4 min-h-[400px]">
          <p className="text-xs text-gray-400 mb-2 text-center">Preview</p>
          {/* Bubble */}
          <div
            className="absolute bottom-6 right-6 w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: config.primary_color }}
          >
            <svg className="w-6 h-6 fill-white" viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
          </div>
          {/* Chat panel preview */}
          <div className="absolute bottom-20 right-6 w-52 bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-2.5 text-white text-xs font-semibold" style={{ background: config.primary_color }}>
              {config.bot_name || "Assistant"}
            </div>
            <div className="p-2.5">
              <div className="bg-gray-100 rounded-xl px-3 py-2 text-xs text-gray-700">
                {config.welcome_message || "Hi! How can I help?"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
