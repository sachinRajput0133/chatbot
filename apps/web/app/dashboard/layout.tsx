"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import type { RootState } from "@/lib/store";
import { clearToken } from "@/lib/api/client";
import { ChatbotWidget } from "@/app/components/ChatbotWidget";
import { HelpChatWidget } from "@/app/components/HelpChatWidget";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/dashboard/knowledge", label: "Knowledge Base", icon: "psychology" },
  { href: "/dashboard/customize", label: "Customize Bot", icon: "tune" },
  { href: "/dashboard/embed", label: "Embed Code", icon: "code" },
  { href: "/dashboard/conversations", label: "Conversations", icon: "forum" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "insights" },
  { href: "/dashboard/billing", label: "Billing", icon: "payments" },
  { href: "/dashboard/profile", label: "Profile", icon: "account_circle" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const tenant = useSelector((s: RootState) => s.auth.tenant);

  function logout() {
    clearToken();
    router.push("/login");
  }

  const planLabel = tenant?.plan
    ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1) + " Tier"
    : "Free Tier";

  return (
    <div className="flex min-h-screen" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Sidebar */}
      <aside className="h-screen w-64 fixed left-0 top-0 flex flex-col p-6 gap-4" style={{ backgroundColor: "#f3f4f5" }}>
        {/* Logo */}
        <div className="mb-6 px-2">
          <h1 className="text-xl font-black text-orange-600">ChatBot AI</h1>
          <p className="text-[10px] text-gray-400 tracking-widest uppercase opacity-80">{planLabel}</p>
        </div>

        {/* New Chat button */}
        <button
          onClick={() => router.push("/dashboard/conversations")}
          className="flex items-center gap-3 w-full p-3 rounded-xl text-white font-bold text-sm mb-2 active:scale-95 transition-transform"
          style={{ backgroundColor: "#a93200" }}
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: "20px" }}>
            add_circle
          </span>
          New Chat
        </button>

        {/* Nav */}
        <nav className="flex-1 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 p-3 rounded-lg text-sm font-bold transition-all ${
                  active
                    ? "bg-white text-orange-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-200"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "20px" }}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="mt-auto pt-4" style={{ borderTop: "1px solid rgba(142,112,103,0.1)" }}>
          <button
            onClick={logout}
            className="w-full text-left flex items-center gap-3 p-3 rounded-lg text-sm font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>logout</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 flex-1 overflow-y-auto">{children}</main>

      {/* Owner preview: load their own chatbot so they can test it (bottom-right) */}
      <ChatbotWidget />
      {/* Platform help bot for all dashboard users (bottom-left) */}
      <HelpChatWidget />
    </div>
  );
}
