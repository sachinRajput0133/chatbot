"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    Promise.all([api.me(), api.getAnalytics()])
      .then(([me, stats]) => { setData(me); setAnalytics(stats); })
      .catch(() => router.push("/login"));
  }, []);

  if (!data) return <div className="text-gray-400">Loading...</div>;

  const { tenant } = data;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Welcome, {tenant.business_name}</h1>
      <p className="text-gray-500 text-sm mb-8">Your chatbot is live at bot ID: <code className="bg-gray-100 px-1 rounded">{tenant.bot_id}</code></p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Plan", value: tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1) },
          { label: "Messages This Month", value: analytics?.messages_this_month ?? "—" },
          { label: "Total Conversations", value: analytics?.total_conversations ?? "—" },
          { label: "Avg Messages / Chat", value: analytics?.avg_messages_per_conversation ?? "—" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border p-5">
            <div className="text-gray-500 text-xs mb-1">{s.label}</div>
            <div className="text-2xl font-bold text-indigo-600">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <h2 className="font-semibold mb-3">Quick Actions</h2>
      <div className="grid grid-cols-3 gap-4">
        {[
          { href: "/dashboard/knowledge", label: "Upload Knowledge", desc: "Add FAQs, docs, menus" },
          { href: "/dashboard/customize", label: "Customize Bot", desc: "Colors, name, greeting" },
          { href: "/dashboard/embed", label: "Get Embed Code", desc: "Copy script tag" },
        ].map((a) => (
          <a
            key={a.href}
            href={a.href}
            className="bg-white rounded-xl border p-5 hover:shadow-md transition"
          >
            <div className="font-semibold mb-1">{a.label}</div>
            <div className="text-sm text-gray-500">{a.desc}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
