"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";

interface UnansweredQuestion {
  question: string;
  count: number;
  last_asked: string;
  sample_conversation_id: string;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [unanswered, setUnanswered] = useState<UnansweredQuestion[] | null>(null);

  useEffect(() => {
    Promise.all([api.getAnalytics(), api.me()])
      .then(([s, m]) => { setStats(s); setMe(m); })
      .catch(() => router.push("/login"));
    api.getUnansweredQuestions(30, 10)
      .then((rows) => setUnanswered(rows))
      .catch(() => setUnanswered([]));
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

      {/* CSAT card */}
      <div className="bg-white border rounded-xl p-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-gray-500 text-xs">Customer Satisfaction (CSAT)</div>
          <div className="text-xs text-gray-400">{stats.csat_count ?? 0} {stats.csat_count === 1 ? "rating" : "ratings"}</div>
        </div>
        {stats.csat_count > 0 ? (
          <>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-indigo-600">
                {stats.avg_csat?.toFixed(2) ?? "—"}
              </div>
              <div className="text-sm text-gray-500">/ 5</div>
              <div className="text-yellow-500 ml-2">
                {"★".repeat(Math.round(stats.avg_csat ?? 0))}
                <span className="text-gray-300">{"★".repeat(5 - Math.round(stats.avg_csat ?? 0))}</span>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.csat_distribution?.[String(star)] ?? 0;
                const pct = stats.csat_count > 0 ? (count / stats.csat_count) * 100 : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-6 text-gray-500">{star}★</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-400" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-gray-500">{count}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-400">No ratings collected yet.</div>
        )}
      </div>

      {/* Top Unanswered Questions */}
      <div className="bg-white border rounded-xl p-5 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium">Top Unanswered Questions</div>
            <div className="text-xs text-gray-400">
              Questions your bot couldn't answer well — last 30 days
            </div>
          </div>
        </div>

        {unanswered === null ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : unanswered.length === 0 ? (
          <div className="text-sm text-gray-500 py-4 text-center">
            Your bot is answering everything! 🎉
          </div>
        ) : (
          <ul className="divide-y">
            {unanswered.slice(0, 10).map((q, i) => (
              <li key={`${q.sample_conversation_id}-${i}`} className="py-3 flex items-start gap-3">
                <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">
                  {q.count}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-800 truncate" title={q.question}>
                    {q.question}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Last asked {formatRelative(q.last_asked)}
                  </div>
                </div>
                <a
                  href={`/dashboard/conversations?conversation_id=${q.sample_conversation_id}`}
                  className="text-xs text-indigo-600 hover:underline whitespace-nowrap"
                >
                  View conversation
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
