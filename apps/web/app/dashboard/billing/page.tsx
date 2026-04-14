"use client";
export const dynamic = "force-dynamic";
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
    messages: "100",
    messagesLabel: "msgs/mo",
    docs: "1",
    docsLabel: "document",
    features: ["Community Support"],
    popular: false,
  },
  {
    key: "starter",
    name: "Starter",
    inr: "₹999",
    usd: "$19",
    messages: "1,000",
    messagesLabel: "msgs/mo",
    docs: "10",
    docsLabel: "documents",
    features: ["Email Support"],
    popular: false,
  },
  {
    key: "growth",
    name: "Growth",
    inr: "₹2,999",
    usd: "$49",
    messages: "10,000",
    messagesLabel: "msgs/mo",
    docs: "Unlimited",
    docsLabel: "documents",
    features: ["Priority Support", "3 Websites"],
    popular: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    inr: "₹9,999",
    usd: "$149",
    messages: "Unlimited",
    messagesLabel: "msgs/mo",
    docs: "Unlimited",
    docsLabel: "documents",
    features: ["Dedicated Manager", "SLA & Audit"],
    popular: false,
  },
];

const PLAN_LOSSES: Record<string, string[]> = {
  starter: ["1,000 AI messages/month", "10 knowledge documents", "Email support"],
  growth:  ["10,000 AI messages/month", "Unlimited documents", "Priority support", "3 websites"],
  enterprise: ["Unlimited AI messages", "Unlimited documents", "Dedicated support", "Unlimited websites"],
};

const MESSAGE_LIMITS: Record<string, number> = {
  free: 100,
  starter: 1000,
  growth: 10000,
  enterprise: 999999,
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
  const endDate = periodEnd
    ? new Date(periodEnd).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : "end of billing period";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-indigo-600 px-6 py-5 text-white">
          <div className="text-xs font-semibold uppercase tracking-widest opacity-75 mb-1">Before you go</div>
          <h2 className="text-xl font-bold">You'll lose access to these features</h2>
        </div>
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
          <button
            onClick={onClose}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition mb-3"
          >
            Keep my {plan.charAt(0).toUpperCase() + plan.slice(1)} plan
          </button>
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

  if (!me) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentPlan = me.tenant.plan as string;
  const msgCount = me.tenant.message_count_month ?? 0;
  const msgLimit = MESSAGE_LIMITS[currentPlan] ?? 100;
  const msgPercent = msgLimit >= 999999 ? 5 : Math.min(100, Math.round((msgCount / msgLimit) * 100));

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "end of billing period";

  return (
    <div className="max-w-6xl">
      {showCancelModal && (
        <CancelModal
          plan={subscription?.plan || currentPlan}
          periodEnd={subscription?.current_period_end}
          onConfirm={confirmCancel}
          onClose={() => setShowCancelModal(false)}
          loading={cancelling}
        />
      )}

      {/* Cancellation pending alert */}
      {subscription?.cancel_at_period_end && (
        <div className="mb-8 p-5 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 shrink-0">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className="font-bold text-gray-900">Subscription Cancellation Pending</h4>
              <p className="text-gray-600 text-sm">
                Your subscription will be cancelled on <span className="font-bold">{periodEnd}</span>. Access will remain until then.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Payment success banner */}
      {justPaid && (
        <div className="mb-8 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium">
          Payment successful! Your plan has been upgraded.
        </div>
      )}

      {/* Page title */}
      <div className="mb-10">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-2">Billing & Subscription</h2>
        <p className="text-gray-500 max-w-2xl text-sm">
          Manage your plan, usage limits, and subscription.{" "}
          {isIndia ? "Payments via Razorpay (UPI, cards, net banking)." : "Payments via Stripe (all major cards)."}
        </p>
      </div>

      {/* Active subscription bar */}
      {subscription && !subscription.cancel_at_period_end && (
        <div className="mb-8 bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between shadow-sm">
          <div className="text-sm text-gray-700">
            <span className="font-semibold capitalize text-indigo-700">{subscription.plan}</span>
            <span className="text-gray-400"> plan · active</span>
            {subscription.current_period_end && (
              <span className="text-gray-400 ml-1">
                · Renews {new Date(subscription.current_period_end).toLocaleDateString()}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowCancelModal(true)}
            className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition"
          >
            Manage subscription
          </button>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-12">
        {PLANS.map((plan) => {
          const isCurrent = plan.key === currentPlan;
          const isFree = plan.key === "free";

          return (
            <div
              key={plan.key}
              className={`bg-white rounded-xl flex flex-col relative transition-all duration-300 ${
                plan.popular
                  ? "border-2 border-indigo-500 shadow-[0px_12px_40px_rgba(99,102,241,0.15)] scale-105 z-10"
                  : "border border-gray-200 shadow-sm hover:shadow-md"
              } p-7`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-lg whitespace-nowrap">
                  Most Popular
                </div>
              )}

              <div className="mb-7">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-gray-900">
                    {isIndia ? plan.inr : plan.usd}
                  </span>
                  <span className="text-gray-400 text-sm">/mo</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                <li className="flex items-start gap-3 text-sm">
                  <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-500">
                    <span className="font-bold text-gray-900">{plan.messages}</span>{" "}
                    {plan.messagesLabel}
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  <span className="text-gray-500">
                    <span className="font-bold text-gray-900">{plan.docs}</span>{" "}
                    {plan.docsLabel}
                  </span>
                </li>
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <svg className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-500">{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="w-full py-3 rounded-xl border border-gray-200 text-center text-sm font-bold text-gray-400">
                  Current Plan
                </div>
              ) : isFree ? (
                <div className="w-full py-3 rounded-xl border border-gray-200 text-center text-sm font-bold text-gray-400">
                  Free
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.key)}
                  disabled={!!loading}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition active:scale-95 disabled:opacity-60 ${
                    plan.popular
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-700"
                      : "border border-indigo-600 text-indigo-600 hover:bg-indigo-50"
                  }`}
                >
                  {loading === plan.key ? "Redirecting..." : "Upgrade"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Usage + CTA bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
        {/* Usage card */}
        <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-2xl p-7 flex flex-col justify-between">
          <div>
            <h4 className="text-lg font-bold mb-6 text-gray-900">Current Usage Period</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-semibold text-gray-500">AI Messages</span>
                  <span className="text-base font-bold text-gray-900">
                    {msgCount.toLocaleString()} / {msgLimit >= 999999 ? "∞" : msgLimit.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${msgPercent >= 90 ? "bg-red-500" : "bg-indigo-600"}`}
                    style={{ width: `${msgPercent}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-semibold text-gray-500">Plan</span>
                  <span className="text-base font-bold text-indigo-700 capitalize">{currentPlan}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 rounded-full"
                    style={{
                      width: currentPlan === "free" ? "5%" : currentPlan === "starter" ? "33%" : currentPlan === "growth" ? "66%" : "100%",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="mt-8 p-4 bg-white rounded-xl border border-gray-100 flex items-center gap-3">
            <svg className="w-5 h-5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-gray-500">
              Message count resets monthly. Upgrade anytime to increase your limits.
            </p>
          </div>
        </div>

        {/* CTA card */}
        <div className="bg-gray-900 rounded-2xl p-7 flex flex-col justify-end min-h-[220px] relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-indigo-500 to-transparent" />
          <div className="relative z-10">
            <svg className="w-8 h-8 text-indigo-400 mb-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h6.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0017.25 8h-6.572l1.305-6.093z" clipRule="evenodd" />
            </svg>
            <h4 className="text-xl font-black text-white mb-2 leading-tight">Need more power?</h4>
            <p className="text-gray-400 text-sm mb-5">
              Unlock higher limits and dedicated support with a higher plan.
            </p>
            <button
              onClick={() => handleUpgrade("growth")}
              disabled={currentPlan === "growth" || currentPlan === "enterprise" || !!loading}
              className="bg-white text-gray-900 px-5 py-2 rounded-full font-bold text-sm hover:bg-indigo-50 transition-colors disabled:opacity-50"
            >
              {currentPlan === "growth" || currentPlan === "enterprise" ? "Already upgraded" : "Explore Plans"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
