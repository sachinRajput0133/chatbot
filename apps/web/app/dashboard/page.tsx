"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/lib/api/client";
import ConversationsView from "./conversations/ConversationsView";

const ORANGE = "#F15A24";
const ORANGE_SOFT = "#FFE9DF";

// Lazy-load the 4 Action Items sub-tab views — only fetched when first opened
const KnowledgeView = dynamic(() => import("./knowledge/KnowledgeView"), {
  ssr: false,
  loading: () => <SubTabLoading />,
});
const CustomizeView = dynamic(() => import("./customize/CustomizeView"), {
  ssr: false,
  loading: () => <SubTabLoading />,
});
const LeadCaptureView = dynamic(() => import("./lead-capture/LeadCaptureView"), {
  ssr: false,
  loading: () => <SubTabLoading />,
});
const EmbedView = dynamic(() => import("./embed/EmbedView"), {
  ssr: false,
  loading: () => <SubTabLoading />,
});

type TabKey = "conversations" | "knowledge" | "customize" | "leads" | "embed" | "clients" | "my-team";

const TABS: { id: TabKey; label: string; icon?: string }[] = [
  { id: "knowledge", label: "Upload Knowledge", icon: "upload_file" },
  { id: "customize", label: "Customize Bot", icon: "tune" },
  { id: "leads", label: "Lead Capture", icon: "person_add" },
  { id: "embed", label: "Get Embed Code", icon: "code" },
  { id: "conversations", label: "Conversations" },
];

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as TabKey | null;
  const tab: TabKey = TABS.some((t) => t.id === tabParam) ? (tabParam as TabKey) : "conversations";

  const [me, setMe] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  function setTab(next: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    Promise.all([api.me(), api.getAnalytics()])
      .then(([m, a]) => {
        setMe(m);
        setAnalytics(a);
      })
      .catch(() => router.push("/login"));
  }, []);

  if (!me) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-sm font-medium">Loading...</div>
      </div>
    );
  }

  const firstName =
    (me?.user?.email?.split("@")[0] || "there")
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const totalConversations = analytics?.total_conversations ?? 0;
  const totalLeads = analytics?.total_leads ?? 24;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-[28px] font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            Good afternoon, {firstName}! <span>👋</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Here's what's happening with your AI Agent today.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white border border-gray-200 text-[13px] font-semibold text-gray-700">
            <span className="material-symbols-outlined text-gray-500" style={{ fontSize: "18px" }}>
              calendar_today
            </span>
            May 11 – May 17, 2026
            <span className="material-symbols-outlined text-gray-500" style={{ fontSize: "18px" }}>
              expand_more
            </span>
          </div>
          <button className="text-[13px] font-bold" style={{ color: ORANGE }}>
            Today
          </button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          icon="group_add"
          iconBg={ORANGE_SOFT}
          iconColor={ORANGE}
          label="Leads Captured"
          value={String(totalLeads)}
          delta="20%"
          viewLabel="View leads"
          viewHref="/dashboard/lead-capture"
        />
        <KpiCard
          icon="chat"
          iconBg={ORANGE_SOFT}
          iconColor={ORANGE}
          label="Conversations"
          value={String(totalConversations)}
          delta="12%"
          viewLabel="View conversations"
          viewHref="/dashboard/conversations"
        />
        <KpiCard
          icon="event"
          iconBg="#DCFCE7"
          iconColor="#16a34a"
          label="Meetings Booked"
          value="5"
          delta="25%"
          viewLabel="View meetings"
          viewHref="/dashboard/conversations"
        />
        <KpiCard
          icon="monitoring"
          iconBg={ORANGE_SOFT}
          iconColor={ORANGE}
          label="Revenue Influenced"
          value="$12,450"
          delta="18%"
          viewLabel="View revenue"
          viewHref="/dashboard/analytics"
        />
        <KpiCard
          icon="schedule"
          iconBg="#EDE9FE"
          iconColor="#8b5cf6"
          label="Avg. Response Time"
          value="2.4m"
          delta="15%"
          viewLabel="View analytics"
          viewHref="/dashboard/analytics"
        />
      </div>

      {/* ── Tab bar ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-2">
          <div className="flex items-center overflow-x-auto no-scrollbar">
            {TABS.map((t) => (
              <TabButton
                key={t.id}
                active={tab === t.id}
                onClick={() => setTab(t.id)}
                icon={t.icon}
              >
                {t.label}
              </TabButton>
            ))}
          </div>
          {tab === "conversations" && (
            <button
              onClick={() => router.push("/dashboard/conversations")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 mr-2 shrink-0"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
                open_in_full
              </span>
              Expand
            </button>
          )}
        </div>

        {/* ── Tab body ── */}
        {tab === "conversations" && (
          <div className="h-[calc(100vh-440px)] min-h-[480px] overflow-hidden">
            <ConversationsView embedded />
          </div>
        )}
        {tab === "knowledge" && <div className="bg-gray-50/40 p-6"><KnowledgeView embedded /></div>}
        {tab === "customize" && <div className="bg-gray-50/40 p-6"><CustomizeView embedded /></div>}
        {tab === "leads" && <div className="bg-gray-50/40 p-6"><LeadCaptureView embedded /></div>}
        {tab === "embed" && <div className="bg-gray-50/40 p-6"><EmbedView embedded /></div>}
        {tab === "clients" && (
          <EmptyState
            icon="groups"
            title="Clients Coming Soon"
            subtitle="View visitor profiles, deal history, and lifecycle in one place."
          />
        )}
        {tab === "my-team" && (
          <EmptyState
            icon="groups_3"
            title="Team Workspace Coming Soon"
            subtitle="Invite teammates and assign conversations from Members → Roles & Permissions."
          />
        )}
      </div>
    </div>
  );
}

/* ─── KPI Card ─── */
function KpiCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  delta,
  viewLabel,
  viewHref,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  delta: string;
  viewLabel: string;
  viewHref: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: iconBg }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "20px", color: iconColor, fontVariationSettings: "'FILL' 1" }}
          >
            {icon}
          </span>
        </div>
        <span className="text-[13px] font-semibold text-gray-700">{label}</span>
      </div>
      <div className="text-3xl font-extrabold text-gray-900 leading-none">{value}</div>
      <div className="flex items-center gap-1 mt-3 text-xs">
        <span className="material-symbols-outlined text-emerald-500" style={{ fontSize: "16px" }}>
          arrow_upward
        </span>
        <span className="font-bold text-emerald-500">{delta}</span>
        <span className="text-gray-500">vs last 7 days</span>
      </div>
      <Link
        href={viewHref}
        className="inline-flex items-center gap-1 mt-3 text-[13px] font-bold"
        style={{ color: ORANGE }}
      >
        {viewLabel}
        <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
          arrow_forward
        </span>
      </Link>
    </div>
  );
}

/* ─── Tab Button ─── */
function TabButton({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-3.5 text-[14px] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
        active ? "" : "text-gray-500 hover:text-gray-700"
      }`}
      style={active ? { color: ORANGE } : {}}
    >
      {icon && (
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "18px", fontVariationSettings: active ? "'FILL' 1" : "" }}
        >
          {icon}
        </span>
      )}
      {children}
      {active && (
        <span
          className="absolute left-3 right-3 bottom-0 h-[2.5px] rounded-full"
          style={{ background: ORANGE }}
        />
      )}
    </button>
  );
}

/* ─── Sub-tab loading skeleton ─── */
function SubTabLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="text-gray-400 text-sm font-medium">Loading...</div>
    </div>
  );
}

/* ─── Empty State ─── */
function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: ORANGE_SOFT }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "40px", color: ORANGE, fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>
      <h3 className="text-lg font-extrabold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-md">{subtitle}</p>
    </div>
  );
}
