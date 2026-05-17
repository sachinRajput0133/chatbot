"use client";
import { useEffect } from "react";
import { Provider, useDispatch } from "react-redux";
import { store } from "@/lib/store";
import { setAuth } from "@/lib/slices/authSlice";
import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

function AuthHydrator() {
  const dispatch = useDispatch();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("cb_token");
    const userRaw = localStorage.getItem("cb_user");
    if (!token || !userRaw) return;
    try {
      const user = JSON.parse(userRaw);
      dispatch(setAuth({ token, user }));
    } catch {
      // stale/corrupt — ignore
    }
  }, [dispatch]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Provider store={store}>
        <AuthHydrator />
        {children}
      </Provider>
    </GoogleOAuthProvider>
  );
}
