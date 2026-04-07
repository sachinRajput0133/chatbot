/**
 * ChatBot SaaS Widget
 * Embeds a floating chat bubble on any website.
 *
 * Usage:
 *   <script>window.ChatbotConfig = { botId: 'YOUR-BOT-ID' };</script>
 *   <script async src="https://yourdomain.com/widget.js"></script>
 */

interface ChatbotConfig {
  botId: string;
  apiUrl?: string;
}

interface WidgetConfig {
  bot_name: string;
  primary_color: string;
  welcome_message: string;
  position: "bottom-right" | "bottom-left";
  avatar_url: string | null;
}

declare global {
  interface Window {
    ChatbotConfig: ChatbotConfig;
  }
}

(function () {
  // Prevent double-init (React Strict Mode / multiple script loads)
  if ((window as any).__cb_loaded) return;
  (window as any).__cb_loaded = true;

  const config: ChatbotConfig = window.ChatbotConfig;
  if (!config || !config.botId) {
    console.warn("[Chatbot] Missing ChatbotConfig.botId");
    return;
  }

  const BOT_ID = config.botId;
  const API_URL = (config.apiUrl || "").replace(/\/$/, "") || "";

  // ── Visitor session ────────────────────────────────────────────────────────
  function getVisitorId(): string {
    const key = `cb_visitor_${BOT_ID}`;
    let id = localStorage.getItem(key);
    if (!id) {
      id = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  }

  function getConversationId(): string | null {
    return localStorage.getItem(`cb_conv_${BOT_ID}`);
  }

  function setConversationId(id: string) {
    localStorage.setItem(`cb_conv_${BOT_ID}`, id);
  }

  const visitorId = getVisitorId();
  let conversationId: string | null = getConversationId();
  let widgetConfig: WidgetConfig | null = null;
  let isOpen = false;

  // ── Fetch widget config ────────────────────────────────────────────────────
  async function fetchConfig(): Promise<WidgetConfig> {
    const res = await fetch(`${API_URL}/api/widget-config/${BOT_ID}`);
    if (!res.ok) throw new Error("Failed to load bot config");
    return res.json();
  }

  // ── Send message ───────────────────────────────────────────────────────────
  async function sendMessage(message: string): Promise<string> {
    const res = await fetch(`${API_URL}/api/chat/${BOT_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        visitor_id: visitorId,
        conversation_id: conversationId || null,
        page_url: window.location.href,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error getting response");
    }
    const data = await res.json();
    conversationId = data.conversation_id;
    setConversationId(conversationId!);
    return data.reply;
  }

  // ── Inject styles ──────────────────────────────────────────────────────────
  function injectStyles(color: string) {
    const style = document.createElement("style");
    style.textContent = `
      #cb-widget * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      #cb-bubble {
        position: fixed; bottom: 24px; width: 56px; height: 56px;
        border-radius: 50%; background: ${color}; border: none; cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,0.18); display: flex; align-items: center;
        justify-content: center; z-index: 999998; transition: transform 0.2s;
      }
      #cb-bubble:hover { transform: scale(1.08); }
      #cb-bubble svg { width: 26px; height: 26px; fill: white; }
      #cb-panel {
        position: fixed; bottom: 92px; width: 360px; max-height: 520px;
        background: #fff; border-radius: 16px; display: flex; flex-direction: column;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15); z-index: 999999;
        overflow: hidden; transition: opacity 0.2s, transform 0.2s;
      }
      #cb-panel.cb-hidden { opacity: 0; pointer-events: none; transform: translateY(12px); }
      #cb-header {
        background: ${color}; color: white; padding: 14px 16px;
        display: flex; align-items: center; gap: 10px;
      }
      #cb-header .cb-avatar {
        width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,0.25);
        display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
      }
      #cb-header .cb-title { font-weight: 600; font-size: 15px; }
      #cb-header .cb-subtitle { font-size: 11px; opacity: 0.85; }
      #cb-header button {
        margin-left: auto; background: none; border: none; cursor: pointer;
        color: white; padding: 4px; opacity: 0.8; line-height: 1;
      }
      #cb-messages {
        flex: 1; overflow-y: auto; padding: 14px 12px; display: flex;
        flex-direction: column; gap: 8px; scroll-behavior: smooth;
      }
      .cb-msg { max-width: 80%; padding: 9px 13px; border-radius: 14px; font-size: 14px; line-height: 1.45; word-wrap: break-word; }
      .cb-msg.cb-user { background: ${color}; color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
      .cb-msg.cb-bot { background: #f1f3f4; color: #1a1a1a; align-self: flex-start; border-bottom-left-radius: 4px; }
      .cb-typing { display: flex; gap: 4px; align-items: center; padding: 10px 13px; }
      .cb-dot { width: 7px; height: 7px; border-radius: 50%; background: #999; animation: cb-bounce 1.2s infinite; }
      .cb-dot:nth-child(2) { animation-delay: 0.2s; }
      .cb-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes cb-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
      #cb-input-row { display: flex; gap: 8px; padding: 10px 12px; border-top: 1px solid #eee; }
      #cb-input {
        flex: 1; border: 1px solid #ddd; border-radius: 20px; padding: 9px 14px;
        font-size: 14px; outline: none; resize: none; line-height: 1.4;
        max-height: 80px; overflow-y: auto;
      }
      #cb-input:focus { border-color: ${color}; }
      #cb-send {
        width: 38px; height: 38px; border-radius: 50%; background: ${color};
        border: none; cursor: pointer; display: flex; align-items: center;
        justify-content: center; flex-shrink: 0; align-self: flex-end;
        transition: opacity 0.2s;
      }
      #cb-send:disabled { opacity: 0.5; cursor: not-allowed; }
      #cb-send svg { width: 18px; height: 18px; fill: white; }
      #cb-powered { text-align: center; font-size: 10px; color: #bbb; padding: 4px 0 8px; }
      @media (max-width: 480px) {
        #cb-panel { width: calc(100vw - 24px); bottom: 88px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Build DOM ──────────────────────────────────────────────────────────────
  function buildWidget(wc: WidgetConfig) {
    const isRight = wc.position !== "bottom-left";
    const side = isRight ? "right: 24px;" : "left: 24px;";

    const container = document.createElement("div");
    container.id = "cb-widget";

    container.innerHTML = `
      <button id="cb-bubble" style="${side}" aria-label="Open chat">
        <svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
      </button>
      <div id="cb-panel" class="cb-hidden" style="${side}">
        <div id="cb-header">
          <div class="cb-avatar">${wc.avatar_url ? `<img src="${wc.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : "🤖"}</div>
          <div>
            <div class="cb-title">${escHtml(wc.bot_name)}</div>
            <div class="cb-subtitle">Online · Typically replies instantly</div>
          </div>
          <button onclick="document.getElementById('cb-panel').classList.add('cb-hidden')" aria-label="Close">✕</button>
        </div>
        <div id="cb-messages"></div>
        <div id="cb-input-row">
          <textarea id="cb-input" rows="1" placeholder="Type a message..." maxlength="1000"></textarea>
          <button id="cb-send" aria-label="Send">
            <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
          </button>
        </div>
        <div id="cb-powered">Powered by ChatBot AI</div>
      </div>
    `;

    document.body.appendChild(container);

    const bubble = document.getElementById("cb-bubble")!;
    const panel = document.getElementById("cb-panel")!;
    const messagesEl = document.getElementById("cb-messages")!;
    const inputEl = document.getElementById("cb-input") as HTMLTextAreaElement;
    const sendBtn = document.getElementById("cb-send") as HTMLButtonElement;

    // Show welcome message
    appendMessage(wc.welcome_message, "bot", messagesEl);

    bubble.addEventListener("click", () => {
      isOpen = !isOpen;
      panel.classList.toggle("cb-hidden", !isOpen);
      if (isOpen) {
        inputEl.focus();
        bubble.innerHTML = `<svg viewBox="0 0 24 24" style="fill:white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
      } else {
        bubble.innerHTML = `<svg viewBox="0 0 24 24" style="fill:white"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>`;
      }
    });

    async function submit() {
      const text = inputEl.value.trim();
      if (!text || sendBtn.disabled) return;

      inputEl.value = "";
      inputEl.style.height = "auto";
      sendBtn.disabled = true;

      appendMessage(text, "user", messagesEl);
      const typing = appendTyping(messagesEl);

      try {
        const reply = await sendMessage(text);
        typing.remove();
        appendMessage(reply, "bot", messagesEl);
      } catch (e: any) {
        typing.remove();
        appendMessage(e.message || "Something went wrong. Please try again.", "bot", messagesEl);
      } finally {
        sendBtn.disabled = false;
        inputEl.focus();
      }
    }

    sendBtn.addEventListener("click", submit);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    });

    // Auto-resize textarea
    inputEl.addEventListener("input", () => {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + "px";
    });
  }

  function appendMessage(text: string, role: "user" | "bot", container: HTMLElement): HTMLElement {
    const div = document.createElement("div");
    div.className = `cb-msg cb-${role}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  function appendTyping(container: HTMLElement): HTMLElement {
    const div = document.createElement("div");
    div.className = "cb-msg cb-bot cb-typing";
    div.innerHTML = `<div class="cb-dot"></div><div class="cb-dot"></div><div class="cb-dot"></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  }

  function escHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    try {
      widgetConfig = await fetchConfig();
      injectStyles(widgetConfig.primary_color);
      buildWidget(widgetConfig);
    } catch (e) {
      console.error("[Chatbot] Failed to initialize:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Allow cleanup & reinit (used by dashboard's ChatbotWidget component)
  (window as any).__cb_destroy = () => {
    document.getElementById("cb-widget")?.remove();
    delete (window as any).__cb_loaded;
    delete (window as any).__cb_destroy;
  };
})();
