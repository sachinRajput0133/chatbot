"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function EmbedPage() {
  const router = useRouter();
  const [botId, setBotId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.me()
      .then((d) => setBotId(d.tenant.bot_id))
      .catch(() => router.push("/login"));
  }, []);

  if (!botId) return <div className="text-gray-400">Loading...</div>;

  const scriptTag = `<!-- ChatBot AI Widget -->
<script>
  window.ChatbotConfig = { botId: '${botId}' };
</script>
<script async src="${API_URL}/widget.js"></script>`;

  function copy() {
    navigator.clipboard.writeText(scriptTag);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1">Embed Code</h1>
      <p className="text-gray-500 text-sm mb-6">Copy and paste this code before the closing &lt;/body&gt; tag on your website.</p>

      <div className="bg-gray-900 text-green-400 rounded-xl p-5 font-mono text-sm mb-4 whitespace-pre">
        {scriptTag}
      </div>

      <button
        onClick={copy}
        className={`px-6 py-2.5 rounded-lg font-semibold transition ${copied ? "bg-green-600 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}
      >
        {copied ? "Copied!" : "Copy Code"}
      </button>

      <div className="mt-8 grid grid-cols-2 gap-4">
        {[
          { platform: "WordPress", steps: ["Go to Appearance → Theme Editor", "Edit footer.php", "Paste before </body>"] },
          { platform: "Shopify", steps: ["Go to Online Store → Themes", "Edit code → theme.liquid", "Paste before </body>"] },
          { platform: "Wix", steps: ["Settings → Custom Code", "Add code to bottom of page", "Paste and save"] },
          { platform: "Squarespace", steps: ["Settings → Advanced → Code Injection", "Paste in Footer section"] },
        ].map((p) => (
          <div key={p.platform} className="bg-white rounded-xl border p-4">
            <div className="font-semibold text-sm mb-2">{p.platform}</div>
            <ol className="text-xs text-gray-500 list-decimal list-inside space-y-1">
              {p.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-indigo-50 rounded-xl p-4 text-sm text-indigo-700">
        <strong>Your Bot ID:</strong> <code className="bg-indigo-100 px-1 rounded">{botId}</code>
        <p className="text-xs mt-1 text-indigo-500">This is unique to your account. Never share it publicly.</p>
      </div>
    </div>
  );
}
