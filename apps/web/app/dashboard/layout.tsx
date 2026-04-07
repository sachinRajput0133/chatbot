"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "@/lib/api";
import { ChatbotWidget } from "@/app/components/ChatbotWidget";
import { HelpChatWidget } from "@/app/components/HelpChatWidget";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "📊" },
  { href: "/dashboard/knowledge", label: "Knowledge Base", icon: "📚" },
  { href: "/dashboard/customize", label: "Customize Bot", icon: "🎨" },
  { href: "/dashboard/embed", label: "Embed Code", icon: "🔗" },
  { href: "/dashboard/conversations", label: "Conversations", icon: "💬" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "📈" },
  { href: "/dashboard/billing", label: "Billing", icon: "💳" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <span className="font-bold text-indigo-600 text-lg">ChatBot AI</span>
        </div>
        <nav className="flex-1 p-3 flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
                pathname === item.href
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t">
          <button
            onClick={logout}
            className="w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>

      {/* Owner preview: load their own chatbot so they can test it (bottom-right) */}
      <ChatbotWidget />
      {/* Platform help bot for all dashboard users (bottom-left) */}
      <HelpChatWidget />
    </div>
  );
}
