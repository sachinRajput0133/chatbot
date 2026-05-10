"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { useDispatch } from "react-redux";
import { useLoginMutation, useGoogleAuthMutation, authApi } from "@/lib/api";
import { setAuth } from "@/lib/slices/authSlice";
import { store } from "@/lib/store";

function parseToken(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return {
      id: payload.sub as string,
      email: (payload.email as string) || "",
      role: (payload.role as string) || "owner",
      tenant_id: (payload.tenant_id as string) || "",
    };
  } catch {
    return { id: "", email: "", role: "owner", tenant_id: "" };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [login, { isLoading }] = useLoginMutation();
  const [googleAuth, { isLoading: googleLoading }] = useGoogleAuthMutation();

  function triggerGoogleLogin() {
    const btn = googleButtonRef.current?.querySelector("div[role='button']") as HTMLElement | null;
    btn?.click();
  }

  async function hydrateAndRedirect(token: string) {
    const me = await store.dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true })).unwrap();
    const base = parseToken(token);
    dispatch(setAuth({
      token,
      user: {
        ...base,
        is_google_user: me.user.is_google_user,
        role_id: me.user.role_id ?? null,
        role_name: me.user.role_name ?? null,
        must_change_password: me.user.must_change_password ?? false,
        permissions: me.user.permissions ?? [],
      },
    }));
    if (me.user.must_change_password) {
      router.push("/dashboard/complete-invitation");
    } else {
      router.push("/dashboard");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await login(form).unwrap();
      dispatch(setAuth({ token: res.access_token, user: parseToken(res.access_token) }));
      await hydrateAndRedirect(res.access_token);
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail || "Invalid email or password.");
    }
  }

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    if (!credentialResponse.credential) return;
    setError("");
    try {
      const res = await googleAuth({ credential: credentialResponse.credential }).unwrap();
      dispatch(setAuth({ token: res.access_token, user: parseToken(res.access_token) }));
      await hydrateAndRedirect(res.access_token);
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail || "Google sign-in failed. Try again.");
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row bg-white"
      style={{ fontFamily: "'Manrope', sans-serif" }}
    >
      {/* ────────── Left: Cosmic Hero ────────── */}
      <section className="relative hidden md:flex md:w-1/2 min-h-screen overflow-hidden text-white p-10 lg:p-14 flex-col justify-between">
        {/* Background layers */}
        <div className="absolute inset-0 bg-[#0b0426]" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0b40] via-[#0b0426] to-[#260b3d]" />
        <div className="pointer-events-none absolute -top-20 -left-20 w-[420px] h-[420px] rounded-full bg-violet-600/30 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 -right-24 w-[460px] h-[460px] rounded-full bg-fuchsia-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-1/4 w-[520px] h-[520px] rounded-full bg-pink-500/20 blur-3xl" />
        {/* Stars */}
        <div className="pointer-events-none absolute inset-0 opacity-60">
          {Array.from({ length: 60 }).map((_, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: `${Math.random() * 2 + 0.5}px`,
                height: `${Math.random() * 2 + 0.5}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.7 + 0.2,
              }}
            />
          ))}
        </div>

        {/* Decorative bot mascot + rings (right side, behind content) */}
        <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-[640px] h-[640px] -mr-40 opacity-90">
          <BotIllustration />
        </div>

        {/* Top: Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <BotMark className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">
            ChatBot <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">AI</span>
          </span>
        </div>

        {/* Middle: Headline + Features */}
        <div className="relative z-10 max-w-xl space-y-8">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-violet-400/40 bg-violet-500/10 backdrop-blur text-[11px] font-extrabold tracking-[0.14em] uppercase text-violet-100">
            <Sparkle className="w-3 h-3 text-fuchsia-300" />
            AI Sales &amp; Support Agent
          </span>

          <h1 className="text-5xl lg:text-[56px] leading-[1.05] font-extrabold tracking-tight">
            Power Your Business
            <br />
            With{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              Intelligent
            </span>
            <br />
            <span className="bg-gradient-to-r from-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              AI Agents
            </span>
          </h1>

          <p className="text-[16px] leading-relaxed text-white/70 max-w-md">
            Engage visitors, capture leads, automate support, and drive more
            revenue — all in one powerful platform.
          </p>

          <ul className="space-y-3.5 pt-2">
            <FeatureRow
              iconBg="bg-gradient-to-br from-violet-500 to-fuchsia-600"
              icon={<ChatBubbleIcon />}
              title="AI-Powered Conversations"
              desc="Human-like interactions that engage and convert visitors instantly."
            />
            <FeatureRow
              iconBg="bg-gradient-to-br from-rose-500 to-pink-600"
              icon={<TrendUpIcon />}
              title="Capture & Convert More Leads"
              desc="Qualify leads, book meetings, and close deals automatically."
            />
            <FeatureRow
              iconBg="bg-gradient-to-br from-orange-400 to-amber-500"
              icon={<HeadsetSolidIcon />}
              title="Automate Support 24/7"
              desc="Resolve customer queries and deliver exceptional support around the clock."
            />
            <FeatureRow
              iconBg="bg-gradient-to-br from-teal-500 to-emerald-600"
              icon={<ShieldSolidIcon />}
              title="Enterprise-Grade Security"
              desc="Your data is protected with top-tier security and 99.9% uptime."
            />
          </ul>
        </div>

        {/* Bottom: Trust */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex -space-x-2.5">
            {[
              "https://i.pravatar.cc/64?img=47",
              "https://i.pravatar.cc/64?img=32",
              "https://i.pravatar.cc/64?img=12",
              "https://i.pravatar.cc/64?img=68",
            ].map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                className="w-9 h-9 rounded-full border-2 border-[#0b0426] object-cover"
              />
            ))}
          </div>
          <p className="text-[13px] text-white/70 font-medium">
            Trusted by{" "}
            <span className="font-bold text-white">1,000+ businesses</span>{" "}
            worldwide
          </p>
        </div>
      </section>

      {/* ────────── Right: Sign-in form ────────── */}
      <section className="relative w-full md:w-1/2 flex flex-col bg-white">
        {/* Top: support */}
        <div className="flex justify-end items-center px-6 md:px-12 lg:px-16 py-6 md:py-7 text-sm">
          <span className="text-slate-500">Need help?</span>
          <a
            href="#"
            className="ml-2 font-semibold text-violet-600 hover:text-violet-700"
          >
            Support
          </a>
        </div>

        {/* Center form */}
        <div className="flex-1 flex items-center justify-center px-6 md:px-12 lg:px-16 pb-10">
          <div className="w-full max-w-md space-y-7">
            <div className="space-y-2.5">
              <h2 className="text-4xl md:text-[40px] font-extrabold text-slate-900 tracking-tight leading-tight">
                Welcome Back
              </h2>
              <p className="text-slate-500 text-[15px] leading-relaxed">
                Sign in to access your dashboard and manage your AI agents.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                <span className="font-semibold">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label className="block text-[13px] font-bold text-slate-900" htmlFor="email">
                  Work Email
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <MailIcon />
                  </span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="name@company.com"
                    className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all outline-none text-slate-900 placeholder:text-slate-400 text-[15px]"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-[13px] font-bold text-slate-900" htmlFor="password">
                    Password
                  </label>
                  <a
                    className="text-[12px] font-bold text-violet-600 hover:text-violet-700"
                    href="#"
                  >
                    Forgot Password?
                  </a>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <LockIcon />
                  </span>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••••"
                    className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-violet-500/10 focus:border-violet-500 transition-all outline-none text-slate-900 placeholder:text-slate-400 text-[15px]"
                  />
                </div>
              </div>

              {/* Remember me */}
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                />
                <span className="text-[13.5px] text-slate-600 font-medium">Remember me</span>
              </label>

              {/* Sign In */}
              <button
                type="submit"
                disabled={isLoading || googleLoading}
                className="w-full py-4 px-6 rounded-xl text-white font-bold text-[15px] flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-60 shadow-lg shadow-violet-300/40"
                style={{
                  backgroundImage:
                    "linear-gradient(95deg, #7c3aed 0%, #a855f7 35%, #ec4899 75%, #f97316 100%)",
                }}
              >
                {isLoading ? "Signing in…" : "Sign In"}
                {!isLoading && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 5l7 7-7 7" />
                  </svg>
                )}
              </button>

              {/* Divider */}
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200" />
                <span className="flex-shrink mx-4 text-[10px] font-bold text-slate-400 tracking-[0.18em] uppercase">
                  Or continue with
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              {/* Hidden GoogleLogin */}
              <div ref={googleButtonRef} className="absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google sign-in was cancelled or failed.")}
                  theme="outline"
                  size="large"
                  text="signin_with"
                  shape="rectangular"
                />
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={triggerGoogleLogin}
                disabled={isLoading || googleLoading}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-white border border-slate-200 rounded-xl font-semibold text-slate-700 text-[15px] hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                {googleLoading ? (
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                {googleLoading ? "Signing in…" : "Continue with Google"}
              </button>
            </form>

            <div className="text-center pt-2">
              <p className="text-slate-500 text-[14px]">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-bold text-violet-600 hover:text-violet-700">
                  Create one free
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom links */}
        <div className="flex justify-end gap-7 px-6 md:px-12 lg:px-16 pb-6 text-[13px] text-slate-500">
          <a href="#" className="hover:text-slate-900 transition-colors">Privacy</a>
          <a href="#" className="hover:text-slate-900 transition-colors">Terms</a>
          <a href="#" className="hover:text-slate-900 transition-colors">Security</a>
        </div>
      </section>
    </div>
  );
}

/* ───────── helpers ───────── */

function FeatureRow({
  iconBg,
  icon,
  title,
  desc,
}: {
  iconBg: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <li className="flex items-start gap-3.5">
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0 shadow-lg shadow-black/30 text-white`}>
        {icon}
      </div>
      <div className="pt-0.5">
        <div className="text-[15px] font-extrabold text-white leading-tight">{title}</div>
        <div className="text-[12.5px] text-white/60 leading-relaxed mt-1 max-w-sm">
          {desc}
        </div>
      </div>
    </li>
  );
}

/* ───────── icons ───────── */

function BotMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a1 1 0 011 1v1.07A7.002 7.002 0 0119 11v3a3 3 0 01-3 3H8a3 3 0 01-3-3v-3a7.002 7.002 0 016-6.93V3a1 1 0 011-1zm-3 9a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM7 19h10v2H7v-2z" />
    </svg>
  );
}

function Sparkle({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 01-11.5 7.2L4 21l1.8-5.5A8 8 0 1121 12z" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="13" cy="12" r="1" fill="currentColor" />
      <circle cx="17" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function TrendUpIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </svg>
  );
}

function HeadsetSolidIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 14v-3a9 9 0 0118 0v3" />
      <path d="M21 19a2 2 0 01-2 2h-1v-6h1a2 2 0 012 2v2zM3 19a2 2 0 002 2h1v-6H5a2 2 0 00-2 2v2z" />
    </svg>
  );
}

function ShieldSolidIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2.5" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

/* Cosmic bot illustration — pure SVG */
function BotIllustration() {
  return (
    <svg viewBox="0 0 600 600" className="w-full h-full" fill="none">
      <defs>
        <radialGradient id="bot-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.6" />
          <stop offset="60%" stopColor="#7c3aed" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bot-body" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="60%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="bot-face" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="ring-grad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#f0abfc" stopOpacity="0.1" />
          <stop offset="50%" stopColor="#e879f9" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Glow */}
      <circle cx="300" cy="300" r="260" fill="url(#bot-glow)" />

      {/* Orbits */}
      <ellipse cx="300" cy="305" rx="240" ry="60" stroke="#a855f7" strokeOpacity="0.18" strokeWidth="1.5" />
      <ellipse cx="300" cy="305" rx="200" ry="46" stroke="#a855f7" strokeOpacity="0.22" strokeWidth="1.5" />

      {/* Floating chat bubbles */}
      <g opacity="0.85">
        <rect x="430" y="120" width="60" height="48" rx="14" fill="#7c3aed" opacity="0.5" />
        <circle cx="448" cy="144" r="2.5" fill="white" />
        <circle cx="460" cy="144" r="2.5" fill="white" />
        <circle cx="472" cy="144" r="2.5" fill="white" />
      </g>
      <g opacity="0.7">
        <rect x="110" y="380" width="74" height="56" rx="16" fill="#a855f7" opacity="0.45" />
        <circle cx="132" cy="408" r="3" fill="white" />
        <circle cx="146" cy="408" r="3" fill="white" />
        <circle cx="160" cy="408" r="3" fill="white" />
      </g>

      {/* Bot body */}
      <g transform="translate(300 290)">
        {/* Antenna */}
        <line x1="0" y1="-130" x2="0" y2="-160" stroke="#a78bfa" strokeWidth="3" strokeLinecap="round" />
        <circle cx="0" cy="-165" r="6" fill="#f0abfc" />
        {/* Head */}
        <ellipse cx="0" cy="0" rx="125" ry="120" fill="url(#bot-body)" />
        {/* Highlight */}
        <ellipse cx="-40" cy="-50" rx="40" ry="28" fill="white" opacity="0.18" />
        {/* Face screen */}
        <rect x="-78" y="-40" width="156" height="100" rx="50" fill="url(#bot-face)" />
        {/* Eyes (smiling arcs) */}
        <path d="M -40 5 Q -28 -18 -16 5" stroke="#c4b5fd" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M  16 5 Q  28 -18  40 5" stroke="#c4b5fd" strokeWidth="6" fill="none" strokeLinecap="round" />
        {/* Side ears */}
        <rect x="-140" y="-22" width="22" height="46" rx="10" fill="#6d28d9" />
        <rect x="118" y="-22" width="22" height="46" rx="10" fill="#6d28d9" />
        <circle cx="-129" cy="0" r="4" fill="#f0abfc" />
        <circle cx="129" cy="0" r="4" fill="#f0abfc" />
      </g>

      {/* Bottom glowing ring/portal */}
      <g transform="translate(300 470)">
        <ellipse cx="0" cy="0" rx="170" ry="22" fill="none" stroke="url(#ring-grad)" strokeWidth="3" />
        <ellipse cx="0" cy="6" rx="120" ry="14" fill="none" stroke="#f0abfc" strokeOpacity="0.5" strokeWidth="2" />
        <ellipse cx="0" cy="-2" rx="60" ry="8" fill="#fde68a" opacity="0.6" />
      </g>

      {/* Particle field */}
      {Array.from({ length: 18 }).map((_, i) => {
        const angle = (i / 18) * Math.PI * 2;
        const r = 250 + (i % 3) * 14;
        const cx = 300 + Math.cos(angle) * r;
        const cy = 305 + Math.sin(angle) * r * 0.25;
        return <circle key={i} cx={cx} cy={cy} r={i % 2 === 0 ? 2.5 : 1.5} fill={i % 2 === 0 ? "#f0abfc" : "#a78bfa"} opacity={0.7} />;
      })}
    </svg>
  );
}
