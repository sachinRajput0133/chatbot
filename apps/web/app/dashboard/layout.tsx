"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { useState, useEffect, useRef } from "react";
import type { RootState } from "@/lib/store";
import { clearToken } from "@/lib/api/client";
import { useCan, useIsOwner } from "@/lib/hooks/useCan";
import { useMeQuery } from "@/lib/api";
import { patchUser, setTenant } from "@/lib/slices/authSlice";
import { ChatbotWidget } from "@/app/components/ChatbotWidget";
import { HelpChatWidget } from "@/app/components/HelpChatWidget";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  module?: string;
  action?: string;
  ownerOnly?: boolean;
};

type NavSection = {
  title?: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    ],
  },
  {
    title: "AI Training",
    items: [
      { href: "/dashboard/knowledge", label: "Knowledge Base", icon: "psychology", module: "knowledge", action: "view" },
      { href: "/dashboard/customize", label: "Customize Bot", icon: "tune", module: "customize", action: "view" },
      { href: "/dashboard/lead-capture", label: "Lead Capture", icon: "person_add", module: "lead_capture", action: "view" },
      { href: "/dashboard/goals", label: "Bot Goals", icon: "track_changes", module: "goals", action: "view" },
    ],
  },
  {
    title: "Analyze",
    items: [
      { href: "/dashboard/conversations", label: "Conversations", icon: "forum", module: "conversations", action: "view" },
      { href: "/dashboard/analytics", label: "Analytics", icon: "insights", module: "analytics", action: "view" },
    ],
  },
  {
    title: "Integrations",
    items: [
      { href: "/dashboard/integrations", label: "Integrations", icon: "hub", module: "integrations", action: "view" },
      { href: "/dashboard/developer", label: "Developer API", icon: "api", module: "developer", action: "view" },
      { href: "/dashboard/embed", label: "Embed Code", icon: "code", module: "embed", action: "view" },
    ],
  },
  {
    title: "Settings",
    items: [
      { href: "/dashboard/billing", label: "Billing", icon: "payments", module: "billing", action: "view" },
      { href: "/dashboard/members", label: "Members", icon: "group", ownerOnly: true },
      { href: "/dashboard/roles", label: "Roles & Permissions", icon: "shield_person", ownerOnly: true },
      { href: "/dashboard/profile", label: "Settings", icon: "settings" },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const tenant = useSelector((s: RootState) => s.auth.tenant);
  const user = useSelector((s: RootState) => s.auth.user);
  const isOwner = useIsOwner();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("cb_sidebar_collapsed");
    if (stored === "1") setSidebarCollapsed(true);
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("cb_sidebar_collapsed", next ? "1" : "0");
      }
      return next;
    });
  }

  const { data: meData } = useMeQuery();

  useEffect(() => {
    if (!meData) return;
    dispatch(
      patchUser({
        role: meData.user.role,
        is_google_user: meData.user.is_google_user,
        role_id: meData.user.role_id ?? null,
        role_name: meData.user.role_name ?? null,
        must_change_password: meData.user.must_change_password ?? false,
        permissions: meData.user.permissions ?? [],
      })
    );
    dispatch(
      setTenant({
        id: meData.tenant.id,
        business_name: meData.tenant.business_name,
        email: meData.tenant.email,
        bot_id: meData.tenant.bot_id,
        plan: meData.tenant.plan,
        country: meData.tenant.country,
        message_count_month: meData.tenant.message_count_month,
      })
    );
  }, [meData, dispatch]);

  useEffect(() => {
    if (
      user?.must_change_password &&
      pathname !== "/dashboard/complete-invitation"
    ) {
      router.replace("/dashboard/complete-invitation");
    }
  }, [user?.must_change_password, pathname, router]);

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

  useEffect(() => {
    setSidebarOpen(false);
    if (pathname === "/dashboard/conversations") {
      setUnreadCount(0);
    }
  }, [pathname]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function logout() {
    clearToken();
    router.push("/login");
  }

  const planLabel = tenant?.plan
    ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1) + " Tier"
    : "Free Tier";

  const displayName =
    (user?.email && user.email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())) ||
    "User";
  const avatarLetter = (user?.email?.[0] ?? "U").toUpperCase();
  const businessName = tenant?.business_name ?? "";

  if (user?.must_change_password && pathname === "/dashboard/complete-invitation") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen bg-white text-gray-700 border-r border-gray-200 flex flex-col z-[70] transition-[transform,width] duration-300 ease-in-out md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } ${isSidebarCollapsed ? "w-20" : "w-64"}`}
      >
        {/* Logo / Brand */}
        <div className={`flex items-center pt-5 pb-4 ${isSidebarCollapsed ? "px-3 flex-col gap-3" : "px-5 justify-between"}`}>
          <div className={`flex items-center ${isSidebarCollapsed ? "" : "gap-2.5"}`}>
            <div className="w-9 h-9 rounded-xl bg-[#F15A24] flex items-center justify-center shadow-lg shadow-orange-900/30 flex-shrink-0">
              <span className="material-symbols-outlined text-white" style={{ fontSize: "20px", fontVariationSettings: "'FILL' 1" }}>
                chat
              </span>
            </div>
            {!isSidebarCollapsed && (
              <span className="text-gray-900 font-bold text-[16px] tracking-tight">ChatBot AI</span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>close</span>
          </button>
          <button
            onClick={toggleSidebarCollapsed}
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:flex p-1 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
              {isSidebarCollapsed ? "menu_open" : "menu"}
            </span>
          </button>
        </div>

        {/* New Conversation */}
        <div className={isSidebarCollapsed ? "px-3 pb-3" : "px-5 pb-3"}>
          <button
            onClick={() => router.push("/dashboard/conversations")}
            title={isSidebarCollapsed ? "New Conversation" : undefined}
            className={`flex items-center justify-center gap-2 w-full rounded-lg bg-[#F15A24] hover:bg-[#D94918] text-white font-semibold text-[13px] shadow-lg shadow-orange-900/40 transition-colors ${
              isSidebarCollapsed ? "py-2.5" : "py-2.5"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
            {!isSidebarCollapsed && "New Conversation"}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 overflow-y-auto no-scrollbar">
          {NAV_SECTIONS.map((section, idx) => (
            <NavSection
              key={section.title ?? `section-${idx}`}
              section={section}
              pathname={pathname}
              unreadCount={unreadCount}
              isOwner={isOwner}
              collapsed={isSidebarCollapsed}
            />
          ))}
        </nav>

        {/* Upgrade Card */}
        {!isSidebarCollapsed && (
          <div className="px-4 pt-4">
            <div className="relative rounded-xl p-4 bg-[#FFF3EC] border border-[#F15A24]/20 overflow-hidden">
              <div className="absolute -top-6 -right-6 w-20 h-20 bg-[#F15A24]/15 blur-2xl rounded-full" />
              <div className="flex items-center gap-2 mb-2 relative">
                <span className="material-symbols-outlined text-[#F15A24]" style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}>
                  diamond
                </span>
                <span className="text-gray-900 text-[13px] font-bold">Upgrade to Pro</span>
              </div>
              <p className="text-gray-600 text-[11px] leading-relaxed mb-3 relative">
                Unlock advanced features, remove limits, and boost performance.
              </p>
              <Link
                href="/dashboard/billing"
                className="flex items-center justify-between w-full py-2 px-3 rounded-lg bg-white hover:bg-gray-50 text-gray-900 font-semibold text-[12px] transition-colors relative border border-gray-200"
              >
                Upgrade Now
                <span className="material-symbols-outlined text-[#F15A24]" style={{ fontSize: "16px" }}>arrow_forward</span>
              </Link>
            </div>
          </div>
        )}

        {/* User footer */}
        <div className={`py-4 mt-3 border-t border-gray-200 ${isSidebarCollapsed ? "px-2" : "px-4"}`}>
          <div className={`flex items-center ${isSidebarCollapsed ? "flex-col gap-2" : "gap-3"}`}>
            <div
              className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              title={isSidebarCollapsed ? `${displayName} — ${businessName || planLabel}` : undefined}
            >
              {avatarLetter}
            </div>
            {!isSidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-gray-900 text-[13px] font-semibold truncate">{displayName}</div>
                <div className="text-gray-500 text-[11px] truncate">{businessName || planLabel}</div>
              </div>
            )}
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 text-gray-500 hover:text-gray-900 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-[padding] duration-300 ease-in-out ${isSidebarCollapsed ? "md:pl-20" : "md:pl-64"}`}>
        {/* Top Bar */}
        <header className="sticky top-0 z-50 h-16 flex items-center justify-between px-4 md:px-8 bg-[#F7F8FA]/80 backdrop-blur-md border-b border-gray-200/60">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="hidden md:flex items-center gap-2 w-full max-w-md bg-white border border-gray-200 rounded-lg px-3.5 py-2">
              <span className="material-symbols-outlined text-gray-400" style={{ fontSize: "20px" }}>search</span>
              <input
                type="text"
                placeholder="Search anything..."
                className="flex-1 bg-transparent outline-none text-sm text-gray-700 placeholder:text-gray-400"
              />
              <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500">
                ⌘K
              </kbd>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>card_giftcard</span>
            </button>
            <button
              onClick={() => router.push("/dashboard/conversations")}
              className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "22px" }}>notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((s) => !s)}
                className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-xs">
                  {avatarLetter}
                </div>
                <div className="hidden md:block text-left leading-tight">
                  <div className="text-[13px] font-semibold text-gray-900 truncate max-w-[140px]">{displayName}</div>
                  <div className="text-[11px] text-gray-500 truncate max-w-[140px]">{businessName || planLabel}</div>
                </div>
                <span className="material-symbols-outlined text-gray-500" style={{ fontSize: "18px" }}>expand_more</span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-sm font-semibold text-gray-900 truncate">{displayName}</div>
                    <div className="text-xs text-gray-500 truncate">{user?.email}</div>
                  </div>
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>settings</span>
                    Settings
                  </Link>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>logout</span>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className={`flex-1 w-full ${pathname.startsWith("/dashboard/conversations") ? "" : "px-4 md:px-8 py-6 md:py-8"}`}>
          {children}
        </main>
      </div>

      <ChatbotWidget />
      <HelpChatWidget />
    </div>
  );
}

function NavSection({
  section,
  pathname,
  unreadCount,
  isOwner,
  collapsed,
}: {
  section: NavSection;
  pathname: string;
  unreadCount: number;
  isOwner: boolean;
  collapsed: boolean;
}) {
  return (
    <div className="mb-3">
      {section.title && !collapsed && (
        <div className="px-3 mt-3 mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-gray-500 uppercase">
          {section.title}
        </div>
      )}
      {section.title && collapsed && (
        <div className="mx-3 my-2 border-t border-gray-200" />
      )}
      <div className="space-y-0.5">
        {section.items.map((item) => (
          <NavLinkItem
            key={item.href}
            item={item}
            pathname={pathname}
            unreadCount={unreadCount}
            isOwner={isOwner}
            collapsed={collapsed}
          />
        ))}
      </div>
    </div>
  );
}

function NavLinkItem({
  item,
  pathname,
  unreadCount,
  isOwner,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  unreadCount: number;
  isOwner: boolean;
  collapsed: boolean;
}) {
  const can = useCan(item.module ?? "", item.action ?? "");

  if (item.ownerOnly && !isOwner) return null;
  if (item.module && item.action && !can) return null;

  const active = pathname === item.href;
  const isConversations = item.href === "/dashboard/conversations";
  const showBadge = isConversations && unreadCount > 0 && !active;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`relative flex items-center rounded-lg text-[13px] font-medium transition-colors ${
        collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2"
      } ${
        active
          ? "bg-[#FFE9DF] text-[#F15A24]"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
      }`}
    >
      <span
        className={`material-symbols-outlined ${active ? "text-[#F15A24]" : ""}`}
        style={{ fontSize: "20px", fontVariationSettings: active ? "'FILL' 1" : "" }}
      >
        {item.icon}
      </span>
      {!collapsed && <span className="flex-1">{item.label}</span>}
      {showBadge && !collapsed && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
      {showBadge && collapsed && (
        <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
