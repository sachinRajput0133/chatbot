"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { useState, useEffect, useRef } from "react";
import type { RootState } from "@/lib/store";
import { clearToken } from "@/lib/api/client";
import { ChatbotWidget } from "@/app/components/ChatbotWidget";
import { HelpChatWidget } from "@/app/components/HelpChatWidget";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/knowledge", label: "Knowledge Base", icon: "psychology" },
  { href: "/dashboard/customize", label: "Customize Bot", icon: "tune" },
  { href: "/dashboard/lead-capture", label: "Lead Capture", icon: "person_add" },
  { href: "/dashboard/goals", label: "Bot Goals", icon: "track_changes" },
  { href: "/dashboard/embed", label: "Embed Code", icon: "code" },
  { href: "/dashboard/developer", label: "Developer API", icon: "api" },
  { href: "/dashboard/conversations", label: "Conversations", icon: "forum" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "insights" },
  { href: "/dashboard/integrations", label: "Integrations", icon: "hub" },
  { href: "/dashboard/billing", label: "Billing", icon: "payments" },
  { href: "/dashboard/profile", label: "Profile", icon: "account_circle" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tenant = useSelector((s: RootState) => s.auth.tenant);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isSidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function fetchUnread() {
      const token = typeof window !== "undefined" ? localStorage.getItem("cb_token") : null;
      if (!token) return;
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${apiUrl}/api/conversations/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count ?? 0);
        }
      } catch {
        // silently ignore network errors
      }
    }

    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
    if (pathname === "/dashboard/conversations") {
      setUnreadCount(0);
    }
  }, [pathname]);

  function logout() {
    clearToken();
    router.push("/login");
  }

  const planLabel = tenant?.plan
    ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1) + " Tier"
    : "Free Tier";

  return (
    <div className="flex min-h-screen bg-gray-50" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-72 bg-white border-r border-gray-100 flex flex-col p-6 z-[70] transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "#f9fafb" }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between mb-8 px-2">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tighter">ChatBot AI</h1>
            <p className="text-[10px] text-orange-600 font-bold tracking-widest uppercase opacity-80">{planLabel}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-2 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* New Chat button */}
        <button
          onClick={() => router.push("/dashboard/conversations")}
          className="flex items-center justify-center gap-3 w-full py-4 px-6 rounded-2xl text-white font-bold text-sm mb-6 shadow-lg shadow-orange-900/20 active:scale-95 transition-all"
          style={{ backgroundColor: "#F15A24" }}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: "20px" }}>
            add_circle
          </span>
          New Conversation
        </button>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto no-scrollbar pr-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const isConversations = item.href === "/dashboard/conversations";
            const showBadge = isConversations && unreadCount > 0 && !active;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-[14px] font-bold transition-all ${
                  active
                    ? "bg-white text-orange-600 shadow-sm border border-gray-100"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "22px", fontVariationSettings: active ? "'FILL' 1" : "" }}
                >
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-orange-600 text-white text-[10px] font-black flex items-center justify-center leading-none">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User / Logout */}
        <div className="mt-8 pt-6 border-t border-gray-200/60">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-72">
        {/* Mobile Top Bar */}
        <header className="sticky top-0 z-50 h-16 md:hidden flex items-center justify-between px-6 bg-white/80 backdrop-blur-md border-bottom border-gray-100">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="text-lg font-black text-gray-900 tracking-tight">ChatBot AI</h1>
          <div className="w-9" /> {/* Spacer for balance */}
        </header>

        <main className="flex-1 p-6 md:p-10 lg:p-12 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Owner preview: load their own chatbot so they can test it (bottom-right) */}
      <ChatbotWidget />
      {/* Platform help bot for all dashboard users (bottom-left) */}
      <HelpChatWidget />
    </div>
  );
}
