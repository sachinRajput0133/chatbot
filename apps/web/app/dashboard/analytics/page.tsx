"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

export default function AnalyticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    Promise.all([api.getAnalytics(), api.me()])
      .then(([s, m]) => { setStats(s); setMe(m); })
      .catch(() => router.push("/login"));
  }, []);

  const LIMITS: Record<string, number> = { free: 100, starter: 1000, growth: 10000, enterprise: 999999 };

  if (!stats || !me) return <div className="text-gray-400">Loading...</div>;

  const plan = me.tenant.plan;
  const limit = LIMITS[plan] || 100;
  const used = me.tenant.message_count_month;
  const pct = Math.min((used / limit) * 100, 100);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>

      {/* Usage bar */}
      <div className="bg-white border rounded-xl p-5 mb-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Messages This Month</span>
          <span className="text-gray-500">{used} / {limit === 999999 ? "∞" : limit}</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct > 80 ? "#ef4444" : "#6366f1" }}
          />
        </div>
        {pct > 80 && (
          <p className="text-xs text-red-500 mt-2">
            You've used {Math.round(pct)}% of your monthly limit.{" "}
            <a href="/dashboard/billing" className="underline">Upgrade your plan</a>
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Total Conversations", value: stats.total_conversations },
          { label: "Total Messages", value: stats.total_messages },
          { label: "Messages This Month", value: stats.messages_this_month },
          { label: "Avg Messages per Chat", value: stats.avg_messages_per_conversation },
        ].map((s) => (
          <div key={s.label} className="bg-white border rounded-xl p-5">
            <div className="text-gray-500 text-xs mb-1">{s.label}</div>
            <div className="text-3xl font-bold text-indigo-600">{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
