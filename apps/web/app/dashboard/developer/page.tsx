"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export default function DeveloperPage() {
  const router = useRouter();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      const data = await api.getApiKeys();
      setApiKeys(data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    try {
      const data = await api.createApiKey({ name: newKeyName });
      setApiKeys([data, ...apiKeys]);
      setNewlyCreatedKey(data.key);
      setIsCreating(false);
      setNewKeyName("");
    } catch (err) {
      alert("Failed to create API Key.");
    }
  }

  async function handleDeleteKey(id: string) {
    if (!confirm("Are you sure you want to revoke this API Key? Any integrations using it will immediately stop working.")) return;
    try {
      await api.deleteApiKey(id);
      setApiKeys(apiKeys.filter((k) => k.id !== id));
    } catch (err) {
      alert("Failed to revoke API Key.");
    }
  }

  if (loading) {
    return <div className="text-gray-400 text-sm font-bold py-20 text-center">Loading...</div>;
  }

  return (
    <div className="max-w-5xl" style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-extrabold tracking-tighter text-gray-900 leading-tight mb-4">
            Developer <span className="text-indigo-600 italic">API.</span>
          </h1>
          <p className="text-lg text-gray-500 font-medium leading-relaxed max-w-2xl">
            Integrate your chatbot's data into your own applications using our public REST API.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        
        {/* Left Column: API Keys */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">API Keys</h2>
            <button
              onClick={() => { setIsCreating(!isCreating); setNewlyCreatedKey(null); }}
              className="px-4 py-2 bg-gray-900 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
            >
              {isCreating ? "Cancel" : "Generate New Key"}
            </button>
          </div>

          {newlyCreatedKey && (
            <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl relative">
              <div className="flex items-start gap-4">
                <span className="material-symbols-outlined text-emerald-500 mt-1">warning</span>
                <div>
                  <h3 className="text-emerald-900 font-bold mb-1">Key Generated Successfully</h3>
                  <p className="text-emerald-700 text-sm mb-4">
                    Please copy this key and store it securely. For your security, <strong className="font-black">it will never be shown again</strong>.
                  </p>
                  <div className="flex items-center gap-3">
                    <code className="bg-white px-4 py-2.5 rounded-lg border border-emerald-100 text-emerald-900 font-mono text-sm flex-1 font-bold">
                      {newlyCreatedKey}
                    </code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(newlyCreatedKey); alert("Copied!"); }}
                      className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isCreating && (
            <form onSubmit={handleCreateKey} className="bg-white border border-gray-200 p-6 rounded-2xl flex items-end gap-4 shadow-sm">
              <div className="flex-1 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Key Name</label>
                <input
                  autoFocus
                  required
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production Backend, Zapier Integration"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:bg-white"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors"
              >
                Create Key
              </button>
            </form>
          )}

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {apiKeys.length === 0 ? (
              <div className="p-10 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-gray-400" style={{ fontSize: "32px" }}>vpn_key_off</span>
                </div>
                <h3 className="text-gray-900 font-bold mb-1">No API Keys</h3>
                <p className="text-gray-500 text-sm">You haven't generated any API keys yet.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Name & Key</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Created</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Last Used</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{key.name}</div>
                        <div className="text-xs text-gray-500 font-mono mt-1">{key.prefix}</div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-600">
                        {new Date(key.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-600">
                        {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : "Never"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteKey(key.id)}
                          className="text-gray-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 p-1"
                          title="Revoke Key"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Column: Documentation Snippets */}
        <div className="space-y-6">
          <div className="bg-gray-900 text-gray-300 p-6 rounded-2xl shadow-xl border border-gray-800">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-400" style={{ fontSize: "20px" }}>terminal</span>
              API Quickstart
            </h3>
            <p className="text-sm mb-6 text-gray-400 leading-relaxed">
              Authenticate your requests by passing the <code className="text-indigo-300">X-API-Key</code> header.
            </p>
            
            <div className="space-y-2 mb-6">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Fetch Conversations</h4>
              <div className="bg-black/50 p-4 rounded-xl overflow-x-auto border border-white/5">
                <pre className="text-[11px] font-mono leading-relaxed">
<span className="text-pink-400">curl</span> -X GET \
  <span className="text-emerald-400">"https://api.yourbot.com/v1/conversations"</span> \
  -H <span className="text-amber-300">"X-API-Key: cb_your_api_key_here"</span>
                </pre>
              </div>
            </div>

            <a href="#" className="text-indigo-400 hover:text-indigo-300 font-bold text-sm inline-flex items-center gap-1 transition-colors">
              Read Full Documentation
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
