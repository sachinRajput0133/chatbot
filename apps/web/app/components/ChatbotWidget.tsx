"use client";
import { useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WIDGET_URL = process.env.NEXT_PUBLIC_WIDGET_URL || "http://localhost:8000/widget.js";

export function ChatbotWidget() {
  const loaded = useRef(false);

  useEffect(() => {
    // Prevent double-init from React Strict Mode
    if (loaded.current) return;
    loaded.current = true;

    const token = localStorage.getItem("cb_token");
    if (!token) return;

    let cancelled = false;

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const botId = data?.tenant?.bot_id;
        if (!botId) return;

        // Clean up any previous instance
        const win = window as any;
        if (typeof win.__cb_destroy === "function") {
          win.__cb_destroy();
        } else {
          document.getElementById("cb-widget")?.remove();
          delete win.__cb_loaded;
        }

        win.ChatbotConfig = { botId, apiUrl: API_URL };

        const script = document.createElement("script");
        script.id = "__cb_script";
        script.src = WIDGET_URL;
        document.body.appendChild(script);
      })
      .catch(() => {/* not logged in */});

    return () => {
      cancelled = true;
      // On unmount, clean up so next mount can reinitialize
      const win = window as any;
      if (typeof win.__cb_destroy === "function") {
        win.__cb_destroy();
      } else {
        document.getElementById("cb-widget")?.remove();
        delete win.__cb_loaded;
      }
      document.getElementById("__cb_script")?.remove();
      loaded.current = false;
    };
  }, []);

  return null;
}
