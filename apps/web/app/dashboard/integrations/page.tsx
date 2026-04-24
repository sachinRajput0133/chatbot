"use client";
import { useState } from "react";
import {
  useSlackStatusQuery,
  useSetSlackWebhookMutation,
  useDeleteSlackWebhookMutation,
  useTestSlackWebhookMutation,
} from "@/lib/api";

type Banner = { type: "success" | "error"; text: string } | null;

export default function IntegrationsPage() {
  const { data: status, isLoading } = useSlackStatusQuery();
  const [setWebhook, { isLoading: saving }] = useSetSlackWebhookMutation();
  const [deleteWebhook, { isLoading: deleting }] = useDeleteSlackWebhookMutation();
  const [testWebhook, { isLoading: testing }] = useTestSlackWebhookMutation();

  const [url, setUrl] = useState("");
  const [banner, setBanner] = useState<Banner>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    try {
      await setWebhook({ webhook_url: url.trim() }).unwrap();
      setBanner({ type: "success", text: "Slack webhook saved." });
      setUrl("");
    } catch (err: unknown) {
      const msg =
        (err as { data?: { detail?: string | { msg?: string }[] } })?.data?.detail;
      const text =
        typeof msg === "string"
          ? msg
          : Array.isArray(msg)
            ? msg[0]?.msg ?? "Failed to save"
            : "Failed to save";
      setBanner({ type: "error", text });
    }
  }

  async function handleTest(useTyped: boolean) {
    setBanner(null);
    try {
      const body = useTyped ? { webhook_url: url.trim() } : {};
      const result = await testWebhook(body).unwrap();
      if (result.ok) {
        setBanner({ type: "success", text: "Test message sent — check your Slack channel." });
      } else {
        setBanner({ type: "error", text: result.detail ?? "Slack rejected the test message." });
      }
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string } })?.data?.detail ?? "Test failed";
      setBanner({ type: "error", text: msg });
    }
  }

  async function handleDisconnect() {
    setBanner(null);
    if (!confirm("Disconnect Slack? Future AI-escalation alerts will only be emailed.")) return;
    try {
      await deleteWebhook().unwrap();
      setBanner({ type: "success", text: "Slack disconnected." });
    } catch {
      setBanner({ type: "error", text: "Failed to disconnect." });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Integrations</h1>
      <p className="text-gray-500 mb-8">
        Connect your team&apos;s tools to get notified when your chatbot needs human help.
      </p>

      {banner && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg text-sm ${
            banner.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {banner.text}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#4A154B] text-white flex items-center justify-center font-bold">
            S
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Slack</h2>
            <p className="text-sm text-gray-500">
              Get a Slack alert when the AI can&apos;t reply to a visitor.
            </p>
          </div>
        </div>

        {status?.configured ? (
          <div className="space-y-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Connected webhook</div>
                <code className="text-sm text-gray-800 font-mono">{status.masked_url}</code>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Connected
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTest(false)}
                disabled={testing}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {testing ? "Sending..." : "Send test message"}
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {deleting ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slack incoming-webhook URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T000/B000/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Create one at{" "}
                <a
                  href="https://api.slack.com/messaging/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  api.slack.com/messaging/webhooks
                </a>
                . Pick the channel alerts should go to.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !url.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => handleTest(true)}
                disabled={testing || !url.trim().startsWith("https://hooks.slack.com/services/")}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                {testing ? "Testing..." : "Test without saving"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
