"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";

declare global {
  interface Window { Razorpay: any; }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById("razorpay-sdk")) { resolve(); return; }
    const s = document.createElement("script");
    s.id = "razorpay-sdk";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.body.appendChild(s);
  });
}

const PLANS = [
  {
    key: "free",
    name: "Free",
    inr: "₹0",
    usd: "$0",
    messages: "100 msgs/mo",
    docs: "1 document",
    features: ["1 website", "Basic support"],
  },
  {
    key: "starter",
    name: "Starter",
    inr: "₹999/mo",
    usd: "$19/mo",
    messages: "1,000 msgs/mo",
    docs: "10 documents",
    features: ["1 website", "Email support"],
    popular: false,
  },
  {
    key: "growth",
    name: "Growth",
    inr: "₹2,999/mo",
    usd: "$49/mo",
    messages: "10,000 msgs/mo",
    docs: "Unlimited docs",
    features: ["3 websites", "Priority support"],
    popular: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    inr: "₹9,999/mo",
    usd: "$149/mo",
    messages: "Unlimited msgs",
    docs: "Unlimited docs",
    features: ["Unlimited websites", "Dedicated support"],
    popular: false,
  },
];

const PLAN_LOSSES: Record<string, string[]> = {
  starter: ["1,000 AI messages/month", "10 knowledge documents", "Email support"],
  growth:  ["10,000 AI messages/month", "Unlimited documents", "Priority support", "3 websites"],
  enterprise: ["Unlimited AI messages", "Unlimited documents", "Dedicated support", "Unlimited websites"],
};

function CancelModal({
  plan,
  periodEnd,
  onConfirm,
  onClose,
  loading,
}: {
  plan: string;
  periodEnd: string | null;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  const losses = PLAN_LOSSES[plan] || [];
  const endDate = periodEnd ? new Date(periodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "end of billing period";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 text-white">
          <div className="text-xs font-semibold uppercase tracking-widest opacity-75 mb-1">Before you go</div>
          <h2 className="text-xl font-bold">You'll lose access to these features</h2>
        </div>

        {/* Loss list */}
        <div className="px-6 py-5">
          <ul className="space-y-2.5 mb-5">
            {losses.map((l) => (
              <li key={l} className="flex items-center gap-3 text-sm text-gray-700">
                <span className="w-5 h-5 rounded-full bg-red-100 text-red-500 flex items-center justify-center shrink-0 text-xs font-bold">✕</span>
                {l}
              </li>
            ))}
          </ul>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 mb-6">
            <strong>Your access continues until {endDate}.</strong> No charge after that.
          </div>

          {/* Primary CTA — keep plan */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition mb-3"
          >
            Keep my {plan.charAt(0).toUpperCase() + plan.slice(1)} plan
          </button>

          {/* Secondary — tiny, low-contrast cancel link */}
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50 transition"
          >
            {loading ? "Cancelling..." : "No thanks, cancel my subscription"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justPaid = searchParams.get("success") === "true";
  const [me, setMe] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isIndia, setIsIndia] = useState(false);

  function loadData() {
    Promise.all([api.me(), api.getSubscription()])
      .then(([m, s]) => {
        setMe(m);
        setSubscription(s);
        setIsIndia(m.tenant.country === "IN");
      })
      .catch(() => router.push("/login"));
  }

  useEffect(() => {
    loadData();
    if (justPaid) {
      const t = setTimeout(loadData, 2000);
      return () => clearTimeout(t);
    }
  }, []);

  async function handleUpgrade(plan: string) {
    setLoading(plan);
    try {
      const result = await api.createCheckout(plan);
      if (result.gateway === "stripe") {
        window.location.href = result.checkout_url!;
      } else if (result.gateway === "razorpay") {
        await loadRazorpayScript();
        const options = {
          key: result.key_id,
          subscription_id: result.subscription_id,
          name: me?.tenant?.business_name || "Chatbot Platform",
          description: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
          prefill: { email: me?.tenant?.email || "" },
          theme: { color: "#6366f1" },
          handler: async function (response: any) {
            try {
              await api.verifyRazorpayPayment({
                payment_id: response.razorpay_payment_id,
                subscription_id: response.razorpay_subscription_id,
                signature: response.razorpay_signature,
                plan,
              });
            } catch (_) {}
            window.location.href = "/dashboard/billing?success=true";
          },
          modal: { ondismiss: () => setLoading(null) },
        };
        new window.Razorpay(options).open();
        return;
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(null);
    }
  }

  async function confirmCancel() {
    setCancelling(true);
    try {
      await api.cancelSubscription();
      setShowCancelModal(false);
      await loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCancelling(false);
    }
  }

  if (!me) return <div className="text-gray-400">Loading...</div>;

  const currentPlan = me.tenant.plan;

  return (
    <div className="max-w-4xl">
      {showCancelModal && (
        <CancelModal
          plan={subscription?.plan || currentPlan}
          periodEnd={subscription?.current_period_end}
          onConfirm={confirmCancel}
          onClose={() => setShowCancelModal(false)}
          loading={cancelling}
        />
      )}

      <h1 className="text-2xl font-bold mb-1">Billing</h1>
      <p className="text-sm text-gray-500 mb-6">
        {isIndia ? "Payments via Razorpay (UPI, cards, net banking)" : "Payments via Stripe (all major cards)"}
      </p>

      {justPaid && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 mb-4 text-sm text-emerald-700 font-medium">
          Payment successful! Your plan has been upgraded.
        </div>
      )}

      {/* Active subscription info bar */}
      {subscription && !subscription.cancel_at_period_end && (
        <div className="bg-white border rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            <span className="font-semibold capitalize text-indigo-700">{subscription.plan}</span>
            <span className="text-gray-400"> plan · active</span>
            {subscription.current_period_end && (
              <span className="text-gray-400 ml-1">
                · Renews {new Date(subscription.current_period_end).toLocaleDateString()}
              </span>
            )}
          </div>
          {/* Manage link — low prominence, not a red button */}
          <button
            onClick={() => setShowCancelModal(true)}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition"
          >
            Manage subscription
          </button>
        </div>
      )}

      {/* Scheduled cancellation notice (like Claude's billing page) */}
      {subscription?.cancel_at_period_end && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-gray-600">
            <span className="text-lg">📅</span>
            <span>
              Your subscription will be cancelled on{" "}
              <strong>{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "end of billing period"}</strong>.
              You'll keep full access until then.
            </span>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-4 gap-4">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`bg-white border rounded-xl p-5 flex flex-col relative ${plan.popular ? "border-indigo-400 shadow-md" : ""}`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                Most Popular
              </div>
            )}
            <div className="font-bold text-lg mb-1">{plan.name}</div>
            <div className="text-2xl font-bold text-indigo-600 mb-0.5">
              {isIndia ? plan.inr : plan.usd}
            </div>
            <div className="text-xs text-gray-400 mb-4">{plan.messages}</div>
            <ul className="text-xs text-gray-500 flex flex-col gap-1 mb-6 flex-1">
              <li>✓ {plan.docs}</li>
              {plan.features.map((f) => <li key={f}>✓ {f}</li>)}
            </ul>
            {plan.key === "free" || plan.key === currentPlan ? (
              <div className="text-center text-sm text-gray-400 font-medium py-2">
                {plan.key === currentPlan ? "Current Plan" : "Free"}
              </div>
            ) : (
              <button
                onClick={() => handleUpgrade(plan.key)}
                disabled={!!loading}
                className={`w-full py-2 rounded-lg text-sm font-semibold transition ${
                  plan.popular
                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                    : "border border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                } disabled:opacity-60`}
              >
                {loading === plan.key ? "Redirecting..." : "Upgrade"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
