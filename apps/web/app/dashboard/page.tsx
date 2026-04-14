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

  if (!data) {
    return (
      <div className="ml-0 p-10 flex items-center justify-center min-h-screen">
        <div className="text-gray-400 text-sm font-bold">Loading...</div>
      </div>
    );
  }

  const { tenant } = data;
  const planLabel = tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1);
  const messagesThisMonth = analytics?.messages_this_month ?? "—";
  const totalConversations = analytics?.total_conversations ?? "—";
  const avgMessages = analytics?.avg_messages_per_conversation ?? "—";

  return (
    <div className="p-10 max-w-[1400px]" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Header */}
      <header className="flex justify-between items-end mb-16">
        <div className="space-y-2">
          <h2 className="text-4xl font-black tracking-tight text-gray-900">
            Welcome, ssss {tenant.business_name}
          </h2>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse inline-block" />
              Bot Active
            </span>
            <span className="text-gray-400 text-sm font-medium">
              ID: {tenant.bot_id?.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <button className="p-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>notifications</span>
          </button>
          <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
            <span className="text-orange-700 font-black text-lg">
              {tenant.business_name?.[0]?.toUpperCase() ?? "A"}
            </span>
          </div>
        </div>
      </header>

      {/* KPI Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
        {/* Plan Card */}
        <div className="col-span-1 p-6 bg-white rounded-xl border border-gray-100 relative overflow-hidden" style={{ boxShadow: "0px 4px 20px rgba(25,28,29,0.06)" }}>
          <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl" style={{ backgroundColor: "rgba(169,50,0,0.05)" }} />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Current Plan</p>
          <h3 className="text-3xl font-black text-gray-900 mb-4">{planLabel}</h3>
          <a
            href="/dashboard/billing"
            className="text-orange-600 text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
          >
            Upgrade to Pro{" "}
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
          </a>
        </div>

        {/* Messages This Month */}
        <div className="col-span-1 p-6 bg-white rounded-xl border border-gray-100" style={{ boxShadow: "0px 4px 20px rgba(25,28,29,0.06)" }}>
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-orange-50 text-orange-600 rounded-lg material-symbols-outlined" style={{ fontSize: "22px" }}>
              send
            </span>
            <span className="text-xs font-bold text-emerald-600">+12%</span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Messages This Month</p>
          <h3 className="text-3xl font-black text-gray-900">{messagesThisMonth}</h3>
        </div>

        {/* Total Conversations */}
        <div className="col-span-1 p-6 bg-white rounded-xl border border-gray-100" style={{ boxShadow: "0px 4px 20px rgba(25,28,29,0.06)" }}>
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg material-symbols-outlined" style={{ fontSize: "22px" }}>
              group
            </span>
            <span className="text-xs font-bold text-emerald-600">+5%</span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total Conversations</p>
          <h3 className="text-3xl font-black text-gray-900">{totalConversations}</h3>
        </div>

        {/* Avg Messages */}
        <div className="col-span-1 p-6 bg-white rounded-xl border border-gray-100" style={{ boxShadow: "0px 4px 20px rgba(25,28,29,0.06)" }}>
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-purple-50 text-purple-600 rounded-lg material-symbols-outlined" style={{ fontSize: "22px" }}>
              speed
            </span>
            <span className="text-xs font-bold text-gray-400">Stable</span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Avg Messages / Chat</p>
          <h3 className="text-3xl font-black text-gray-900">{avgMessages}</h3>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-8">
          <h4 className="text-2xl font-black tracking-tight">Quick Actions</h4>
          <div className="h-px flex-1 mx-8 bg-gray-200" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              href: "/dashboard/knowledge",
              icon: "upload_file",
              title: "Upload Knowledge",
              desc: "Train your AI with PDFs, docs, or manual text to make it an expert in your niche.",
              cta: "Configure",
            },
            {
              href: "/dashboard/customize",
              icon: "palette",
              title: "Customize Bot",
              desc: "Change colors, name, and personality settings to match your brand's identity.",
              cta: "Design",
            },
            {
              href: "/dashboard/embed",
              icon: "terminal",
              title: "Get Embed Code",
              desc: "Copy the snippet to add ChatBot AI to your website or customer support portal.",
              cta: "View Script",
            },
          ].map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="group cursor-pointer bg-gray-50 hover:bg-white transition-all p-8 rounded-xl border border-transparent hover:border-gray-200 hover:shadow-md"
            >
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined text-orange-600" style={{ fontSize: "28px" }}>
                  {a.icon}
                </span>
              </div>
              <h5 className="text-xl font-bold mb-2">{a.title}</h5>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">{a.desc}</p>
              <div className="flex items-center gap-1 text-orange-600 font-bold text-sm">
                {a.cta}{" "}
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>chevron_right</span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Bottom: Performance chart + Upgrade card */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Performance Trends */}
        <div className="lg:col-span-2 bg-white rounded-xl p-8" style={{ boxShadow: "0px 4px 20px rgba(25,28,29,0.06)" }}>
          <div className="flex justify-between items-center mb-10">
            <h4 className="text-xl font-black">Performance Trends</h4>
            <select className="bg-gray-50 border-none rounded-lg text-xs font-bold px-4 py-2 outline-none text-gray-700">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-64 flex items-end justify-between gap-2">
            {[40, 65, 85, 55, 75, 45, 90].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-lg transition-all cursor-help relative group"
                style={{
                  height: `${h}%`,
                  backgroundColor: i === 2 ? "#a93200" : "#e7e8e9",
                }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-4 px-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span key={d} className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d}</span>
            ))}
          </div>
        </div>

        {/* Upgrade CTA */}
        <div
          className="lg:col-span-1 rounded-xl p-8 flex flex-col justify-between relative overflow-hidden"
          style={{ backgroundColor: "#191c1d", boxShadow: "0px 4px 20px rgba(25,28,29,0.06)" }}
        >
          <div
            className="absolute top-0 right-0 w-32 h-32 blur-3xl -mr-10 -mt-10"
            style={{ backgroundColor: "rgba(169,50,0,0.2)" }}
          />
          <div>
            <h4 className="text-xl font-black text-white mb-2">Need a Boost?</h4>
            <p className="text-sm text-gray-400 leading-relaxed">
              Unlock the full power of Enterprise AI training and custom avatars.
            </p>
          </div>
          <div className="space-y-4 mt-8">
            {["Unlimited training data", "Custom API endpoints"].map((feat) => (
              <div key={feat} className="flex items-center gap-3">
                <span className="material-symbols-outlined text-orange-500" style={{ fontSize: "18px" }}>
                  check_circle
                </span>
                <span className="text-sm font-medium text-white">{feat}</span>
              </div>
            ))}
            <a
              href="/dashboard/billing"
              className="block w-full py-4 bg-white text-gray-900 rounded-full font-bold text-sm text-center hover:bg-orange-600 hover:text-white transition-all active:scale-95 mt-4"
            >
              Upgrade Today
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
