"use client";
import { useState } from "react";
import {
  useSlackStatusQuery,
  useSetSlackWebhookMutation,
  useDeleteSlackWebhookMutation,
  useTestSlackWebhookMutation,
  useNotificationEmailsQuery,
  useSetNotificationEmailsMutation,
  useTestNotificationEmailMutation,
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

      <EmailNotificationsCard />
    </div>
  );
}

const MAX_EMAILS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EmailNotificationsCard() {
  const { data } = useNotificationEmailsQuery();
  const [setEmails, { isLoading: saving }] = useSetNotificationEmailsMutation();
  const [sendTest, { isLoading: testing }] = useTestNotificationEmailMutation();

  const [connectDraft, setConnectDraft] = useState("");
  const [draft, setDraft] = useState("");
  const [primaryDraft, setPrimaryDraft] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);

  const cc = data?.cc_emails ?? [];
  const accountEmail = data?.account_email ?? "";
  const primary = data?.primary_email ?? null;
  // "Connected" = the tenant has explicitly configured something beyond the default
  // (account email as primary, no CCs). Until they do, show a Slack-style connect form.
  const isConnected = primary !== null || cc.length > 0;
  const effectivePrimary = primary ?? accountEmail;
  const primaryInput = primaryDraft ?? primary ?? "";

  async function commit(
    next: { primary_email: string | null; cc_emails: string[] },
    successMessage: string = "Notification emails updated."
  ) {
    setBanner(null);
    try {
      await setEmails(next).unwrap();
      setBanner({ type: "success", text: successMessage });
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string | { msg?: string }[] } })?.data?.detail;
      const text =
        typeof msg === "string"
          ? msg
          : Array.isArray(msg)
            ? msg[0]?.msg ?? "Failed to save"
            : "Failed to save";
      setBanner({ type: "error", text });
    }
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    const value = connectDraft.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setBanner({ type: "error", text: "That doesn't look like a valid email address." });
      return;
    }
    await commit({ primary_email: value, cc_emails: [] }, "Email notifications connected.");
    setConnectDraft("");
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect email notifications? Alerts will fall back to your account email only.")) return;
    await commit({ primary_email: null, cc_emails: [] }, "Email notifications disconnected.");
    setPrimaryDraft(null);
    setDraft("");
  }

  async function handleSavePrimary() {
    const value = primaryInput.trim().toLowerCase();
    if (value && !EMAIL_RE.test(value)) {
      setBanner({ type: "error", text: "That doesn't look like a valid email address." });
      return;
    }
    await commit({ primary_email: value || null, cc_emails: cc });
    setPrimaryDraft(null);
  }

  async function handleClearPrimary() {
    await commit({ primary_email: null, cc_emails: cc });
    setPrimaryDraft(null);
  }

  async function handleAddCc(e: React.FormEvent) {
    e.preventDefault();
    const value = draft.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setBanner({ type: "error", text: "That doesn't look like a valid email address." });
      return;
    }
    if (cc.includes(value) || value === (primary ?? "").toLowerCase()) {
      setBanner({ type: "error", text: "That email is already on the list." });
      return;
    }
    if (cc.length >= MAX_EMAILS) {
      setBanner({ type: "error", text: `You can add up to ${MAX_EMAILS} CC emails.` });
      return;
    }
    await commit({ primary_email: primary, cc_emails: [...cc, value] });
    setDraft("");
  }

  async function handleRemoveCc(email: string) {
    await commit({ primary_email: primary, cc_emails: cc.filter((e) => e !== email) });
  }

  async function handleSendTest() {
    setBanner(null);
    try {
      const result = await sendTest().unwrap();
      if (result.ok) {
        const ccNote = result.cc_count > 0 ? ` (+ ${result.cc_count} CC)` : "";
        setBanner({
          type: "success",
          text: `Test email sent to ${result.sent_to}${ccNote}. Check your inbox.`,
        });
      } else {
        setBanner({ type: "error", text: result.detail ?? "Failed to send test email." });
      }
    } catch (err: unknown) {
      const msg = (err as { data?: { detail?: string } })?.data?.detail ?? "Test failed";
      setBanner({ type: "error", text: msg });
    }
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl p-6 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
          @
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">Email notifications</h2>
          <p className="text-sm text-gray-500">
            Pick who gets AI-escalation emails. Optional CCs go to extra addresses.
          </p>
        </div>
        {isConnected && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Connected
          </span>
        )}
      </div>

      {banner && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            banner.type === "success"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {banner.text}
        </div>
      )}

      {!isConnected ? (
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary recipient
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Where escalation emails should be sent. You can add CCs after connecting.
            </p>
            <input
              type="email"
              value={connectDraft}
              onChange={(e) => setConnectDraft(e.target.value)}
              placeholder={accountEmail || "primary@yourcompany.com"}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Tip: use <code className="font-mono text-gray-700">{accountEmail}</code> if you want
              alerts in your account inbox.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving || !connectDraft.trim()}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Connecting..." : "Connect"}
          </button>
        </form>
      ) : (
        <>
          {/* Primary recipient */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary recipient
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Where escalation emails are sent. Leave empty to use your account email (
              <code className="font-mono text-gray-700">{accountEmail}</code>).
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={primaryInput}
                onChange={(e) => setPrimaryDraft(e.target.value)}
                placeholder={accountEmail || "primary@yourcompany.com"}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleSavePrimary}
                disabled={saving || primaryInput.trim().toLowerCase() === (primary ?? "").toLowerCase()}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {primary && (
                <button
                  type="button"
                  onClick={handleClearPrimary}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                  title="Revert to account email"
                >
                  Reset
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Currently sending to: <code className="font-mono text-gray-700">{effectivePrimary || "—"}</code>
              {!primary && accountEmail && (
                <span className="text-gray-400"> (account email)</span>
              )}
            </p>
          </div>

          {/* CC addresses */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CC addresses
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Extra addresses copied on every escalation email. Up to {MAX_EMAILS}.
            </p>

            {cc.length > 0 && (
              <ul className="flex flex-wrap gap-2 mb-3">
                {cc.map((email) => (
                  <li
                    key={email}
                    className="inline-flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-full pl-3 pr-1 py-1 text-sm text-gray-800"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCc(email)}
                      disabled={saving}
                      aria-label={`Remove ${email}`}
                      className="w-5 h-5 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-700 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleAddCc} className="flex gap-2">
              <input
                type="email"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="alerts@yourcompany.com"
                disabled={cc.length >= MAX_EMAILS}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
              />
              <button
                type="submit"
                disabled={saving || !draft.trim() || cc.length >= MAX_EMAILS}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                Add
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-2">
              {cc.length} / {MAX_EMAILS} CC addresses added.
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-gray-500">
              Send a sample email to the primary recipient and any CC addresses above to verify delivery.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSendTest}
                disabled={testing || saving}
                className="shrink-0 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {testing ? "Sending..." : "Send test email"}
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={saving || testing}
                className="shrink-0 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
