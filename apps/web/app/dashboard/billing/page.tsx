"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

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

export default function BillingPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [isIndia, setIsIndia] = useState(false);

  useEffect(() => {
    Promise.all([api.me(), api.getSubscription()])
      .then(([m, s]) => {
        setMe(m);
        setSubscription(s);
        setIsIndia(m.tenant.country === "IN");
      })
      .catch(() => router.push("/login"));
  }, []);

  async function handleUpgrade(plan: string) {
    setLoading(plan);
    try {
      const { checkout_url } = await api.createCheckout(plan);
      window.location.href = checkout_url;
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(null);
    }
  }

  if (!me) return <div className="text-gray-400">Loading...</div>;

  const currentPlan = me.tenant.plan;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Billing</h1>
      <p className="text-sm text-gray-500 mb-6">
        {isIndia ? "Payments via Razorpay (UPI, cards, net banking)" : "Payments via Stripe (all major cards)"}
      </p>

      {subscription && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-sm text-green-700">
          Current plan: <strong>{subscription.plan}</strong> · Status: {subscription.status}
          {subscription.current_period_end && ` · Renews ${new Date(subscription.current_period_end).toLocaleDateString()}`}
        </div>
      )}

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
                disabled={loading === plan.key}
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
