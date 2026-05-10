"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

type TrendPoint = { date: string; messages: number };

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  useEffect(() => {
    Promise.all([api.me(), api.getAnalytics()])
      .then(([m, a]) => {
        setMe(m);
        setAnalytics(a);
      })
      .catch(() => router.push("/login"));
  }, []);

  const trends: TrendPoint[] = analytics?.performance_trends ?? [];
  const totalConversations = analytics?.total_conversations ?? 0;
  const messagesThisMonth = analytics?.messages_this_month ?? 0;

  const dateRangeLabel = useMemo(() => {
    if (trends.length === 0) return "Last 7 days";
    const start = new Date(trends[0].date);
    const end = new Date(trends[trends.length - 1].date);
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
  }, [trends]);

  if (!me) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-sm font-medium">Loading...</div>
      </div>
    );
  }

  const greeting = greetingFor(new Date());
  const firstName = (me?.user?.email ?? "")
    .split("@")[0]
    .replace(/[._-].*$/, "")
    .replace(/\b\w/g, (c: string) => c.toUpperCase()) || "there";

  return (
    <div className="space-y-6">
      {/* Greeting + date range */}
      <div className="flex items-start md:items-end justify-between gap-4 flex-col md:flex-row">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-gray-900">
            {greeting}, {firstName}! <span className="inline-block">👋</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here's what's happening with your AI Agent today.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: "18px" }}>
            calendar_today
          </span>
          <span className="font-medium">{dateRangeLabel}</span>
          <span className="material-symbols-outlined text-gray-400" style={{ fontSize: "18px" }}>
            expand_more
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon="group"
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          label="Leads Captured"
          value="—"
          delta={null}
          trendData={trendOf(trends, 0.4)}
          stroke="#8B5CF6"
        />
        <KpiCard
          icon="chat_bubble"
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
          label="Conversations"
          value={fmtNum(totalConversations)}
          delta={null}
          trendData={trendOf(trends, 1)}
          stroke="#3B82F6"
        />
        <KpiCard
          icon="event_available"
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          label="Meetings Booked"
          value="—"
          delta={null}
          trendData={trendOf(trends, 0.05)}
          stroke="#10B981"
        />
        <KpiCard
          icon="payments"
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
          label="Revenue Influenced"
          value="—"
          delta={null}
          trendData={trendOf(trends, 50)}
          stroke="#F97316"
        />
        <KpiCard
          icon="schedule"
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
          label="Avg. Response Time"
          value={fmtNum(messagesThisMonth) === "0" ? "—" : "1.2s"}
          delta={null}
          trendData={trendOf(trends, 0.3).slice().reverse()}
          stroke="#A855F7"
        />
      </section>

      {/* Quick Actions + Performance */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-gray-200/70 p-5">
          <h3 className="text-base font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <QuickAction
              href="/dashboard/knowledge"
              icon="upload_file"
              iconBg="bg-violet-100"
              iconColor="text-violet-600"
              title="Upload Knowledge"
              desc="Train your AI with documents, PDFs, and more."
            />
            <QuickAction
              href="/dashboard/customize"
              icon="palette"
              iconBg="bg-orange-100"
              iconColor="text-orange-600"
              title="Customize Bot"
              desc="Personalize your bot's appearance and behavior."
            />
            <QuickAction
              href="/dashboard/lead-capture"
              icon="person_add"
              iconBg="bg-emerald-100"
              iconColor="text-emerald-600"
              title="Lead Capture"
              desc="Manage forms and capture high-quality leads."
            />
            <QuickAction
              href="/dashboard/embed"
              icon="code"
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              title="Get Embed Code"
              desc="Add ChatBot AI to your website in minutes."
            />
          </div>
          <Link
            href="/dashboard/analytics"
            className="inline-flex items-center gap-1 mt-4 text-violet-600 text-sm font-semibold hover:gap-2 transition-all"
          >
            View All Actions
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
          </Link>
        </div>

        {/* Performance Overview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/70 p-5">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-base font-bold text-gray-900">Performance Overview</h3>
              <div className="flex items-center gap-4 mt-2">
                <Legend color="#8B5CF6" label="Leads" />
                <Legend color="#3B82F6" label="Conversations" />
                <Legend color="#10B981" label="Revenue" />
              </div>
            </div>
            <select className="bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium px-3 py-1.5 outline-none text-gray-700">
              <option>Last 7 Days</option>
            </select>
          </div>
          <div className="mt-4">
            <PerformanceChart trends={trends} />
          </div>
        </div>
      </section>

      {/* Bottom row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopBotsCard />
        <RecentConversationsCard />
        <UpgradeCard />
      </section>
    </div>
  );
}

/* ───────────── helpers ───────────── */

function greetingFor(d: Date): string {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function fmtNum(n: number): string {
  if (n == null) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return n.toLocaleString();
  return String(n);
}

function trendOf(trends: TrendPoint[], scale: number): number[] {
  if (!trends || trends.length === 0) return [4, 6, 5, 8, 7, 10, 12];
  return trends.map((t) => Math.max(0, t.messages * scale));
}

/* ───────────── KPI Card ───────────── */

function KpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  delta,
  trendData,
  stroke,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  delta: { up: boolean; pct: string } | null;
  trendData: number[];
  stroke: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 ${iconBg} rounded-lg flex items-center justify-center`}>
          <span className={`material-symbols-outlined ${iconColor}`} style={{ fontSize: "20px" }}>
            {icon}
          </span>
        </div>
      </div>
      <p className="text-xs text-gray-500 font-medium mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">{value}</h3>
      {delta ? (
        <div className="flex items-center gap-1 text-xs">
          <span className={`material-symbols-outlined ${delta.up ? "text-emerald-600" : "text-red-500"}`} style={{ fontSize: "14px" }}>
            {delta.up ? "trending_up" : "trending_down"}
          </span>
          <span className={`font-semibold ${delta.up ? "text-emerald-600" : "text-red-500"}`}>{delta.pct}</span>
          <span className="text-gray-400 ml-1">vs last 7 days</span>
        </div>
      ) : (
        <div className="text-xs text-gray-400">vs last 7 days</div>
      )}
      <div className="mt-2 -mx-1">
        <Sparkline data={trendData} stroke={stroke} />
      </div>
    </div>
  );
}

/* ───────────── Sparkline ───────────── */

function Sparkline({ data, stroke }: { data: number[]; stroke: string }) {
  const w = 120;
  const h = 36;
  if (!data || data.length === 0) return <div style={{ height: h }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = w / Math.max(data.length - 1, 1);
  const points = data.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y] as const;
  });
  const d = points.reduce(
    (acc, [x, y], i) => acc + (i === 0 ? `M${x},${y}` : ` L${x},${y}`),
    ""
  );
  const areaD = `${d} L${w},${h} L0,${h} Z`;
  const gid = `g-${stroke.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-9" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.25" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ───────────── Quick Action item ───────────── */

function QuickAction({
  href,
  icon,
  iconBg,
  iconColor,
  title,
  desc,
}: {
  href: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
    >
      <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
        <span className={`material-symbols-outlined ${iconColor}`} style={{ fontSize: "20px" }}>
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 truncate">{desc}</div>
      </div>
      <span className="material-symbols-outlined text-gray-300 group-hover:text-gray-500 transition-colors" style={{ fontSize: "20px" }}>
        chevron_right
      </span>
    </Link>
  );
}

/* ───────────── Performance Chart ───────────── */

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-600">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}

function PerformanceChart({ trends }: { trends: TrendPoint[] }) {
  const data = trends && trends.length ? trends : Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 86400_000).toISOString(),
    messages: 0,
  }));

  const w = 800;
  const h = 240;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const cw = w - padL - padR;
  const ch = h - padT - padB;
  const n = data.length;
  const step = cw / Math.max(n - 1, 1);

  const conv = data.map((d) => d.messages);
  const leads = conv.map((v) => Math.round(v * 0.35));
  const revenue = conv.map((v) => Math.round(v * 0.08));

  const allValues = [...conv, ...leads, ...revenue, 0];
  const maxV = Math.max(...allValues, 10);

  const scaleY = (v: number) => padT + ch - (v / maxV) * ch;
  const scaleX = (i: number) => padL + i * step;

  const buildPath = (vals: number[]) =>
    vals
      .map((v, i) => `${i === 0 ? "M" : "L"}${scaleX(i)},${scaleY(v)}`)
      .join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(maxV * p));

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[240px]">
        {/* Y-axis grid */}
        {yTicks.map((v, i) => {
          const y = scaleY(v);
          return (
            <g key={i}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#F1F2F4" strokeWidth="1" />
              <text x={padL - 8} y={y + 3} textAnchor="end" className="fill-gray-400" style={{ fontSize: "10px" }}>
                {v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v}
              </text>
            </g>
          );
        })}

        {/* Lines */}
        <path d={buildPath(leads)} stroke="#8B5CF6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d={buildPath(conv)} stroke="#3B82F6" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={buildPath(revenue)}
          stroke="#10B981"
          strokeWidth="2"
          fill="none"
          strokeDasharray="4 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots on last point */}
        {[
          { v: leads[n - 1], color: "#8B5CF6" },
          { v: conv[n - 1], color: "#3B82F6" },
          { v: revenue[n - 1], color: "#10B981" },
        ].map((p, i) => (
          <circle key={i} cx={scaleX(n - 1)} cy={scaleY(p.v)} r="3.5" fill="white" stroke={p.color} strokeWidth="2" />
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={scaleX(i)}
            y={h - 8}
            textAnchor="middle"
            className="fill-gray-400"
            style={{ fontSize: "10px" }}
          >
            {new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </text>
        ))}
      </svg>
    </div>
  );
}

/* ───────────── Bottom Cards ───────────── */

function TopBotsCard() {
  const items = [
    { name: "Sales Assistant", convs: "1,245 conversations", delta: "+32%", icon: "support_agent", iconBg: "bg-violet-100", iconColor: "text-violet-600", color: "#8B5CF6" },
    { name: "Support Bot", convs: "980 conversations", delta: "+18%", icon: "headset_mic", iconBg: "bg-blue-100", iconColor: "text-blue-600", color: "#3B82F6" },
    { name: "FAQ Bot", convs: "645 conversations", delta: "+12%", icon: "help", iconBg: "bg-orange-100", iconColor: "text-orange-600", color: "#F97316" },
  ];
  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">Top Performing Bots</h3>
        <Link href="/dashboard/analytics" className="text-violet-600 text-xs font-semibold hover:underline">
          View All
        </Link>
      </div>
      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.name} className="flex items-center gap-3">
            <div className={`w-9 h-9 ${it.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
              <span className={`material-symbols-outlined ${it.iconColor}`} style={{ fontSize: "20px" }}>
                {it.icon}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{it.name}</div>
              <div className="text-xs text-gray-500 truncate">{it.convs}</div>
            </div>
            <div className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5">
              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>arrow_upward</span>
              {it.delta}
            </div>
            <div className="w-16">
              <Sparkline data={[2, 4, 3, 5, 4, 6, 8]} stroke={it.color} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentConversationsCard() {
  const items = [
    { name: "Acme Corp.", msg: "Looking for enterprise pricing details.", tag: "Qualified", tagColor: "bg-emerald-100 text-emerald-700", time: "2m ago", icon: "business" },
    { name: "Jane Cooper", msg: "Can you integrate with Slack?", tag: "Support", tagColor: "bg-blue-100 text-blue-700", time: "15m ago", icon: "person" },
    { name: "Global Solutions", msg: "Interested in booking a demo.", tag: "Meeting", tagColor: "bg-violet-100 text-violet-700", time: "1h ago", icon: "public" },
  ];
  return (
    <div className="bg-white rounded-2xl border border-gray-200/70 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-gray-900">Recent Conversations</h3>
        <Link href="/dashboard/conversations" className="text-violet-600 text-xs font-semibold hover:underline">
          View All
        </Link>
      </div>
      <div className="space-y-3">
        {items.map((it) => (
          <div key={it.name} className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-gray-600" style={{ fontSize: "20px" }}>
                {it.icon}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{it.name}</div>
              <div className="text-xs text-gray-500 truncate">{it.msg}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${it.tagColor}`}>{it.tag}</span>
              <span className="text-[10px] text-gray-400">{it.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UpgradeCard() {
  const features = [
    "Advanced Analytics",
    "Custom Avatars",
    "Priority Support",
    "Team Collaboration",
  ];
  return (
    <div className="relative bg-[#0E1116] rounded-2xl p-5 overflow-hidden text-white">
      <div className="absolute -bottom-10 -right-10 w-44 h-44 bg-violet-600/30 blur-3xl rounded-full" />
      <div className="absolute -top-12 -left-8 w-32 h-32 bg-pink-500/20 blur-3xl rounded-full" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center">
            <span className="material-symbols-outlined text-violet-300" style={{ fontSize: "20px", fontVariationSettings: "'FILL' 1" }}>
              bolt
            </span>
          </div>
          <h3 className="text-base font-bold">Unlock More Power</h3>
        </div>
        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          Upgrade to Enterprise and unlock advanced analytics,{" "}
          <span className="italic underline decoration-dotted">custom</span> avatars, priority support &amp; more.
        </p>
        <ul className="space-y-2 mb-4">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-xs">
              <span className="material-symbols-outlined text-emerald-400" style={{ fontSize: "16px" }}>check</span>
              {f}
            </li>
          ))}
        </ul>
        <Link
          href="/dashboard/billing"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
        >
          Upgrade Now
          <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>arrow_forward</span>
        </Link>
      </div>
    </div>
  );
}
