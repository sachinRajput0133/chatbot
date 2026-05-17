"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import ConversationsView from "./conversations/ConversationsView";

const ORANGE = "#F15A24";
const ORANGE_SOFT = "#FFE9DF";

type TabKey = "conversations" | "action-items" | "clients" | "my-team";

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [tab, setTab] = useState<TabKey>("conversations");

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
          <div className="flex items-center">
            <TabButton active={tab === "conversations"} onClick={() => setTab("conversations")}>
              Conversations
            </TabButton>
            <TabButton active={tab === "action-items"} onClick={() => setTab("action-items")}>
              Action Items
              <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                5
              </span>
            </TabButton>
            <TabButton active={tab === "clients"} onClick={() => setTab("clients")}>
              Clients
            </TabButton>
            <TabButton active={tab === "my-team"} onClick={() => setTab("my-team")}>
              My Team
            </TabButton>
          </div>
          <button
            onClick={() => router.push("/dashboard/conversations")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-[13px] font-semibold text-gray-700 hover:bg-gray-50 mr-2"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
              open_in_full
            </span>
            Expand
          </button>
        </div>

        {/* ── Tab body ── */}
        {tab === "conversations" && (
          <div className="h-[calc(100vh-440px)] min-h-[480px] overflow-hidden">
            <ConversationsView embedded />
          </div>
        )}
        {tab === "action-items" && <ActionItemsPanel />}
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
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-5 py-3.5 text-[14px] font-semibold transition-colors flex items-center ${
        active ? "" : "text-gray-500 hover:text-gray-700"
      }`}
      style={active ? { color: ORANGE } : {}}
    >
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

/* ─── Action Items (Quick Actions) ─── */
function ActionItemsPanel() {
  return (
    <div className="p-6">
      <h3 className="text-base font-bold text-gray-900 mb-1">Quick Actions</h3>
      <p className="text-sm text-gray-500 mb-5">
        Jump straight to the most common setup tasks.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <QuickAction
          href="/dashboard/knowledge"
          icon="upload_file"
          title="Upload Knowledge"
          desc="Add PDFs, URLs, or FAQs to train your bot"
        />
        <QuickAction
          href="/dashboard/customize"
          icon="tune"
          title="Customize Bot"
          desc="Set brand colors, tone of voice, and welcome message"
        />
        <QuickAction
          href="/dashboard/lead-capture"
          icon="person_add"
          title="Lead Capture"
          desc="Configure forms that convert visitors into leads"
        />
        <QuickAction
          href="/dashboard/embed"
          icon="code"
          title="Get Embed Code"
          desc="Copy the snippet to install the widget on your site"
        />
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  desc,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-[#F15A24]/40 hover:bg-[#FFF7F3] transition-colors group"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: ORANGE_SOFT }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "22px", color: ORANGE, fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
      </div>
      <span
        className="material-symbols-outlined text-gray-300 group-hover:text-[#F15A24] transition-colors"
        style={{ fontSize: "22px" }}
      >
        chevron_right
      </span>
    </Link>
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
