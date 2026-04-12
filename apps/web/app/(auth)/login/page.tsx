"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GoogleLogin, CredentialResponse } from "@react-oauth/google";
import { useDispatch } from "react-redux";
import { useLoginMutation, useGoogleAuthMutation, authApi } from "@/lib/api";
import { setAuth } from "@/lib/slices/authSlice";
import { store } from "@/lib/store";

/** Decode JWT payload to extract user fields — no external lib needed */
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
  const [error, setError] = useState("");

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [login, { isLoading }] = useLoginMutation();
  const [googleAuth, { isLoading: googleLoading }] = useGoogleAuthMutation();

  function triggerGoogleLogin() {
    const btn = googleButtonRef.current?.querySelector("div[role='button']") as HTMLElement | null;
    btn?.click();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await login(form).unwrap();
      dispatch(setAuth({ token: res.access_token, user: parseToken(res.access_token) }));
      const me = await store.dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true })).unwrap();
      dispatch(setAuth({ token: res.access_token, user: { ...parseToken(res.access_token), is_google_user: me.user.is_google_user } }));
      router.push("/dashboard");
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
      const me = await store.dispatch(authApi.endpoints.me.initiate(undefined, { forceRefetch: true })).unwrap();
      dispatch(setAuth({ token: res.access_token, user: { ...parseToken(res.access_token), is_google_user: me.user.is_google_user } }));
      router.push("/dashboard");
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail || "Google sign-in failed. Try again.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Fixed Header */}
      <header className="fixed top-0 w-full flex justify-between items-center px-8 py-6 z-50 bg-transparent">
        <div className="text-2xl font-black text-gray-900 tracking-tighter">Lumina</div>
        <div className="flex items-center gap-6">
          <span className="text-sm text-gray-400 hover:text-gray-900 transition-colors cursor-pointer">Support</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row min-h-screen">
        {/* Left Panel: Hero Image + Headline */}
        <section className="relative w-full md:w-1/2 min-h-64 md:min-h-screen overflow-hidden">
          <div className="absolute inset-0 bg-black/30 z-10" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1200&q=80"
            alt="AI technology workspace"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="relative z-20 h-full flex flex-col justify-center px-8 md:px-16 lg:px-24 pt-24 pb-16">
            <div className="max-w-xl">
              <h1 className="text-white text-5xl md:text-6xl leading-none font-extrabold tracking-tighter mb-6">
                Power your website{" "}
                <span style={{ color: "#ffb59e" }}>with Intelligent AI.</span>
              </h1>
              <p className="text-white/90 text-lg md:text-xl font-medium max-w-md">
                The ultimate engine for customer engagement, automated support, and seamless website integration.
              </p>
            </div>
          </div>
          {/* Decorative bar */}
          <div className="absolute bottom-16 left-0 w-32 h-2 z-20" style={{ backgroundColor: "#F15A24" }} />
        </section>

        {/* Right Panel: Login Form */}
        <section className="w-full md:w-1/2 flex items-center justify-center bg-white px-6 py-16 md:p-12 lg:p-24">
          <div className="w-full max-w-md space-y-10">
            <div className="space-y-3">
              <h2 className="text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">Welcome Back</h2>
              <p className="text-gray-500 font-medium">
                Enter your credentials to access your business intelligence dashboard.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-4 rounded-xl flex items-center gap-2">
                <span>⚠</span> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Work Email */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-900 tracking-wide" htmlFor="email">
                  Work Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@company.com"
                  className="w-full px-5 py-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:border-transparent transition-all outline-none text-gray-900 placeholder:text-gray-400"
                  style={{ focusRingColor: "#F15A24" } as React.CSSProperties}
                  onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px #F15A24"; e.target.style.borderColor = "#F15A24"; }}
                  onBlur={(e) => { e.target.style.boxShadow = ""; e.target.style.borderColor = "#e5e7eb"; }}
                />
              </div>

              {/* Password */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-bold text-gray-900 tracking-wide" htmlFor="password">
                    Password
                  </label>
                  <a className="text-xs font-bold transition-colors hover:opacity-80" style={{ color: "#F15A24" }} href="#">
                    Forgot Password?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-5 py-4 bg-white border border-gray-200 rounded-xl transition-all outline-none text-gray-900"
                  onFocus={(e) => { e.target.style.boxShadow = "0 0 0 2px #F15A24"; e.target.style.borderColor = "#F15A24"; }}
                  onBlur={(e) => { e.target.style.boxShadow = ""; e.target.style.borderColor = "#e5e7eb"; }}
                />
              </div>

              {/* Sign In Button */}
              <div className="space-y-5 pt-2">
                <button
                  type="submit"
                  disabled={isLoading || googleLoading}
                  className="w-full text-white py-5 px-8 rounded-full font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-60"
                  style={{ backgroundColor: "#F15A24" }}
                  onMouseEnter={(e) => { if (!isLoading) (e.target as HTMLButtonElement).style.filter = "brightness(1.1)"; }}
                  onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.filter = ""; }}
                >
                  {isLoading ? "Signing in…" : "Sign In"}
                  {!isLoading && (
                    <span className="material-symbols-outlined text-2xl" style={{ fontFamily: "'Material Symbols Outlined'" }}>
                      arrow_forward
                    </span>
                  )}
                </button>

                {/* OR divider */}
                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-gray-100" />
                  <span className="flex-shrink mx-4 text-xs font-bold text-gray-400 tracking-widest">OR CONTINUE WITH</span>
                  <div className="flex-grow border-t border-gray-100" />
                </div>

                {/* Hidden native GoogleLogin — triggered programmatically */}
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

                {/* Custom-styled Google button */}
                <button
                  type="button"
                  onClick={triggerGoogleLogin}
                  disabled={isLoading || googleLoading}
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border-2 border-gray-200 rounded-xl font-semibold text-gray-700 text-base hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {googleLoading ? (
                    <svg className="w-5 h-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  {googleLoading ? "Signing in…" : "Continue with Google"}
                </button>
              </div>
            </form>

            <div className="text-center">
              <p className="text-gray-500 font-medium">
                Need an account?{" "}
                <Link href="/signup" className="font-bold hover:underline ml-1" style={{ color: "#F15A24" }}>
                  Create one free
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Fixed Footer */}
      <footer className="fixed bottom-0 w-full flex justify-between items-center px-8 py-4 z-50 bg-transparent">
        <div className="flex items-center gap-4">
          <span className="font-bold text-gray-900 text-lg">Lumina</span>
          <span className="text-sm text-gray-400 hidden sm:block">© 2024 Lumina. Intelligent Business Automation.</span>
        </div>
        <nav className="flex gap-6">
          <a className="text-sm text-gray-400 hover:text-gray-900 transition-colors" href="#">Privacy</a>
          <a className="text-sm text-gray-400 hover:text-gray-900 transition-colors" href="#">Terms</a>
          <a className="text-sm text-gray-400 hover:text-gray-900 transition-colors" href="#">Security</a>
        </nav>
      </footer>
    </div>
  );
}
