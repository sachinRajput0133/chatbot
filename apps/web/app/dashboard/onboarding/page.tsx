"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

const STEPS = ["Welcome", "Upload Knowledge", "Customize", "Get Embed Code"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [manualText, setManualText] = useState("");
  const [config, setConfig] = useState({ bot_name: "Assistant", primary_color: "#6366f1", welcome_message: "Hi! How can I help you today?" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload() {
    if (!file && !manualText.trim()) { setStep(2); return; }
    setLoading(true);
    try {
      if (file) await api.uploadDocument(file);
      if (manualText.trim()) await api.addManualKnowledge({ title: "My Knowledge", content: manualText });
      setStep(2);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleCustomize() {
    setLoading(true);
    try {
      await api.updateWidgetConfig(config);
      setStep(3);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${i <= step ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-500"}`}>{i + 1}</div>
            {i < STEPS.length - 1 && <div className={`h-0.5 w-12 ${i < step ? "bg-indigo-600" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border p-8">
        {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>}

        {step === 0 && (
          <div className="text-center">
            <div className="text-5xl mb-4">🤖</div>
            <h2 className="text-xl font-bold mb-2">Let's set up your chatbot</h2>
            <p className="text-gray-500 text-sm mb-6">In 3 quick steps, your chatbot will be live on your website.</p>
            <button onClick={() => setStep(1)} className="bg-indigo-600 text-white px-8 py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition">Get Started</button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-xl font-bold mb-1">Upload Your Knowledge</h2>
            <p className="text-gray-500 text-sm mb-4">Add your FAQ, menu, product info, or any text. The bot will use this to answer questions.</p>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center mb-4">
              <input type="file" accept=".pdf,.txt,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="hidden" id="file-up" />
              <label htmlFor="file-up" className="cursor-pointer">
                {file ? <span className="text-indigo-600 font-medium">{file.name}</span> : <span className="text-gray-400">Click to upload PDF, TXT, or DOCX</span>}
              </label>
            </div>
            <p className="text-center text-sm text-gray-400 mb-2">or paste text directly</p>
            <textarea
              rows={4}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Paste your FAQ, pricing, business hours..."
              className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
            />
            <div className="flex gap-3">
              <button onClick={handleUpload} disabled={loading} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-60">
                {loading ? "Uploading..." : "Continue"}
              </button>
              <button onClick={() => setStep(2)} className="text-gray-400 text-sm hover:text-gray-600">Skip for now</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-xl font-bold mb-1">Customize Your Bot</h2>
            <p className="text-gray-500 text-sm mb-4">Make it match your brand.</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-medium">Bot Name</label>
                <input type="text" value={config.bot_name} onChange={(e) => setConfig({ ...config, bot_name: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="text-sm font-medium">Brand Color</label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="color" value={config.primary_color} onChange={(e) => setConfig({ ...config, primary_color: e.target.value })} className="w-10 h-10 rounded cursor-pointer border" />
                  <span className="text-sm text-gray-500">{config.primary_color}</span>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Welcome Message</label>
                <input type="text" value={config.welcome_message} onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <button onClick={handleCustomize} disabled={loading} className="mt-6 w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition disabled:opacity-60">
              {loading ? "Saving..." : "Save & Continue"}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-xl font-bold mb-2">Your chatbot is ready!</h2>
            <p className="text-gray-500 text-sm mb-6">Paste this code before the closing &lt;/body&gt; tag on your website.</p>
            <div className="text-left">
              <a href="/dashboard/embed" className="block w-full text-center bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 transition">
                Get Embed Code
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
