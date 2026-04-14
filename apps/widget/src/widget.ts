/**
 * ChatBot SaaS Widget
 * Embeds a floating chat bubble on any website.
 *
 * Usage:
 *   <script>window.ChatbotConfig = { botId: 'YOUR-BOT-ID' };</script>
 *   <script async src="https://yourdomain.com/widget.js"></script>
 */

interface VisitorUser {
  userId?: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface ChatbotConfig {
  botId: string;
  apiUrl?: string;
  user?: VisitorUser;
}

interface LeadCaptureInfo {
  enabled: boolean;
  collect_name: boolean;
  collect_email: boolean;
  collect_phone: boolean;
  collect_address: boolean;
  title: string;
  subtitle: string;
}

interface WidgetConfig {
  bot_name: string;
  primary_color: string;
  welcome_message: string;
  position: "bottom-right" | "bottom-left";
  avatar_url: string | null;
  lead_capture: LeadCaptureInfo;
  suggested_questions: string[];
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

  // ── Visitor identity ───────────────────────────────────────────────────────
  const userInfo: VisitorUser | null = config.user || null;

  function getVisitorId(): string {
    if (userInfo?.userId) {
      return `usr_${userInfo.userId}`;
    }
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

  function isLeadSubmitted(): boolean {
    return localStorage.getItem(`cb_lead_${BOT_ID}`) === "1";
  }

  function markLeadSubmitted() {
    localStorage.setItem(`cb_lead_${BOT_ID}`, "1");
  }

  const visitorId = getVisitorId();
  let conversationId: string | null = getConversationId();
  let widgetConfig: WidgetConfig | null = null;
  let isOpen = false;

  // Stores contact info collected from the pre-chat lead form (also persisted in localStorage)
  function getStoredLeadInfo(): { name: string; email: string; phone: string; address: string } | null {
    try {
      const raw = localStorage.getItem(`cb_contact_${BOT_ID}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function storeLeadInfo(info: { name: string; email: string; phone: string; address: string }) {
    localStorage.setItem(`cb_contact_${BOT_ID}`, JSON.stringify(info));
  }
  let collectedLeadInfo: { name: string; email: string; phone: string; address: string } | null = getStoredLeadInfo();
  
  const seenMessageIds = new Set<string>();
  let currentTypingIndicator: HTMLElement | null = null;

  // ── Fetch widget config ────────────────────────────────────────────────────
  async function fetchConfig(): Promise<WidgetConfig> {
    const res = await fetch(`${API_URL}/api/widget-config/${BOT_ID}`);
    if (!res.ok) throw new Error("Failed to load bot config");
    return res.json();
  }

  // ── Send message ───────────────────────────────────────────────────────────
  async function sendMessage(message: string): Promise<{ reply: string; messageId: string }> {
    // Build user_info by merging window.ChatbotConfig.user (website owner identity)
    // with collectedLeadInfo from the pre-chat form. Form data takes precedence since
    // it was explicitly entered by this visitor.
    const mergedName = collectedLeadInfo?.name || userInfo?.name || null;
    const mergedEmail = collectedLeadInfo?.email || userInfo?.email || null;
    const mergedPhone = collectedLeadInfo?.phone || userInfo?.phone || null;
    const mergedUserId = userInfo?.userId || null;
    const hasMergedInfo = mergedUserId || mergedName || mergedEmail || mergedPhone;

    const res = await fetch(`${API_URL}/api/chat/${BOT_ID}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        visitor_id: visitorId,
        conversation_id: conversationId || null,
        page_url: window.location.href,
        ...(hasMergedInfo ? {
          user_info: {
            user_id: mergedUserId,
            name: mergedName,
            email: mergedEmail,
            phone: mergedPhone,
          }
        } : {}),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Error getting response");
    }
    const data = await res.json();
    conversationId = data.conversation_id;
    setConversationId(conversationId!);
    return { reply: data.reply, messageId: data.message_id };
  }

  // ── Submit lead form ───────────────────────────────────────────────────────
  async function submitContact(name: string, email: string, phone: string, address: string): Promise<string | null> {
    const body: Record<string, string> = {
      visitor_id: visitorId,
      page_url: window.location.href,
    };
    if (name) body.name = name;
    if (email) body.email = email;
    if (phone) body.phone = phone;
    if (address) body.address = address;

    const res = await fetch(`${API_URL}/api/chat/${BOT_ID}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.conversation_id || null;
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
      .cb-msg.cb-agent { background: #4f46e5; color: white; align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid #4338ca; }
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

      #cb-suggested { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: 10px; }
      .cb-sq-btn { 
        background: #fff; border: 1px solid currentColor; border-radius: 12px; 
        padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; 
        transition: all 0.2s; opacity: 0.9;
      }
      .cb-sq-btn:hover { background: #f8f9fa; opacity: 1; transform: translateY(-1px); }

      /* ── Lead capture form ──────────────────────────────────────────────── */
      #cb-lead-form {
        flex: 1; overflow-y: auto; padding: 20px 16px; display: flex;
        flex-direction: column; gap: 14px;
      }
      #cb-lead-form .cb-lf-title { font-size: 15px; font-weight: 600; color: #111; margin: 0; }
      #cb-lead-form .cb-lf-sub { font-size: 13px; color: #666; margin: 0; line-height: 1.45; }
      #cb-lead-form .cb-lf-fields { display: flex; flex-direction: column; gap: 10px; }
      #cb-lead-form .cb-lf-field { display: flex; flex-direction: column; gap: 4px; }
      #cb-lead-form .cb-lf-field label { font-size: 12px; font-weight: 500; color: #444; }
      #cb-lead-form .cb-lf-field input {
        border: 1px solid #ddd; border-radius: 8px; padding: 9px 12px;
        font-size: 14px; outline: none; transition: border-color 0.15s;
      }
      #cb-lead-form .cb-lf-field input:focus { border-color: ${color}; }
      #cb-lead-form .cb-lf-submit {
        background: ${color}; color: white; border: none; border-radius: 8px;
        padding: 11px; font-size: 14px; font-weight: 600; cursor: pointer;
        transition: opacity 0.2s; margin-top: 2px;
      }
      #cb-lead-form .cb-lf-submit:disabled { opacity: 0.6; cursor: not-allowed; }
      #cb-lead-form .cb-lf-skip {
        background: none; border: none; font-size: 12px; color: #999;
        cursor: pointer; text-decoration: underline; text-align: center; padding: 0;
      }
      #cb-lead-form .cb-lf-error { font-size: 12px; color: #e53e3e; }

      @media (max-width: 480px) {
        #cb-panel { width: calc(100vw - 24px); bottom: 88px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Lead capture form view ─────────────────────────────────────────────────
  function buildLeadForm(
    lc: LeadCaptureInfo,
    messagesEl: HTMLElement,
    onDone: () => void,
  ): HTMLElement {
    const form = document.createElement("div");
    form.id = "cb-lead-form";

    const fields: { id: string; label: string; type: string; placeholder: string }[] = [];
    if (lc.collect_name) fields.push({ id: "cb-lf-name", label: "Your Name", type: "text", placeholder: "Jane Smith" });
    if (lc.collect_email) fields.push({ id: "cb-lf-email", label: "Email Address", type: "email", placeholder: "jane@example.com" });
    if (lc.collect_phone) fields.push({ id: "cb-lf-phone", label: "Phone Number", type: "tel", placeholder: "+1 555 000 0000" });
    if (lc.collect_address) fields.push({ id: "cb-lf-address", label: "Mailing Address", type: "text", placeholder: "123 Main St, City, State" });

    form.innerHTML = `
      <p class="cb-lf-title">${escHtml(lc.title)}</p>
      <p class="cb-lf-sub">${escHtml(lc.subtitle)}</p>
      <div class="cb-lf-fields">
        ${fields.map(f => `
          <div class="cb-lf-field">
            <label for="${f.id}">${f.label}</label>
            <input id="${f.id}" type="${f.type}" placeholder="${f.placeholder}" autocomplete="on">
          </div>
        `).join("")}
      </div>
      <span class="cb-lf-error" style="display:none"></span>
      <button class="cb-lf-submit">Start Chat</button>
      <button class="cb-lf-skip">Skip for now</button>
    `;

    const submitBtn = form.querySelector(".cb-lf-submit") as HTMLButtonElement;
    const skipBtn = form.querySelector(".cb-lf-skip") as HTMLButtonElement;
    const errorEl = form.querySelector(".cb-lf-error") as HTMLElement;

    async function handleSubmit() {
      const nameVal = lc.collect_name ? (form.querySelector("#cb-lf-name") as HTMLInputElement)?.value.trim() : "";
      const emailVal = lc.collect_email ? (form.querySelector("#cb-lf-email") as HTMLInputElement)?.value.trim() : "";
      const phoneVal = lc.collect_phone ? (form.querySelector("#cb-lf-phone") as HTMLInputElement)?.value.trim() : "";
      const addressVal = lc.collect_address ? (form.querySelector("#cb-lf-address") as HTMLInputElement)?.value.trim() : "";

      // Basic validation — require at least one field filled
      if (lc.collect_email && emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        errorEl.textContent = "Please enter a valid email address.";
        errorEl.style.display = "";
        return;
      }
      errorEl.style.display = "none";

      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";

      try {
        const convId = await submitContact(nameVal, emailVal, phoneVal, addressVal);
        if (convId) {
          conversationId = convId;
          setConversationId(convId);
        }
        // Store form values so sendMessage() can pass them as user_info,
        // ensuring the backend skips re-asking for already-collected fields.
        collectedLeadInfo = { name: nameVal, email: emailVal, phone: phoneVal, address: addressVal };
        storeLeadInfo(collectedLeadInfo);
        markLeadSubmitted();
        // Replace form with messages view
        form.remove();
        messagesEl.style.display = "";
        onDone();
      } catch {
        submitBtn.disabled = false;
        submitBtn.textContent = "Start Chat";
        errorEl.textContent = "Something went wrong. Please try again.";
        errorEl.style.display = "";
      }
    }

    submitBtn.addEventListener("click", handleSubmit);
    skipBtn.addEventListener("click", () => {
      markLeadSubmitted();
      form.remove();
      messagesEl.style.display = "";
      onDone();
    });

    return form;
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
    const inputRow = document.getElementById("cb-input-row")!;
    const inputEl = document.getElementById("cb-input") as HTMLTextAreaElement;
    const sendBtn = document.getElementById("cb-send") as HTMLButtonElement;

    // Determine whether to show lead form on first open
    const shouldShowLeadForm =
      wc.lead_capture.enabled &&
      !isLeadSubmitted() &&
      !userInfo?.userId; // Skip form if we already have an identified user

    function showChatView() {
      // Show welcome message and focus input
      appendMessage(wc.welcome_message, "bot", messagesEl);
      if (wc.suggested_questions && wc.suggested_questions.length > 0) {
        appendSuggested(wc.suggested_questions, wc.primary_color, messagesEl, (text) => doSubmit(text));
      }
      inputEl.focus();
    }

    // If lead form is needed, hide the messages + input row initially
    let leadFormReady = false;
    if (shouldShowLeadForm) {
      messagesEl.style.display = "none";
      inputRow.style.display = "none";
    }

    bubble.addEventListener("click", () => {
      isOpen = !isOpen;
      panel.classList.toggle("cb-hidden", !isOpen);

      if (isOpen) {
        // First open: inject lead form if needed
        if (shouldShowLeadForm && !leadFormReady) {
          leadFormReady = true;
          inputRow.style.display = "none";
          const form = buildLeadForm(wc.lead_capture, messagesEl, () => {
            // Lead form done — show chat input and welcome message
            inputRow.style.display = "";
            showChatView();
            inputEl.focus();
          });
          // Insert form between header and powered footer
          const powered = document.getElementById("cb-powered")!;
          panel.insertBefore(form, powered);
        } else if (!shouldShowLeadForm) {
          inputEl.focus();
        }

        bubble.innerHTML = `<svg viewBox="0 0 24 24" style="fill:white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
      } else {
        bubble.innerHTML = `<svg viewBox="0 0 24 24" style="fill:white"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>`;
      }
    });

    // Show welcome immediately if no lead form
    if (!shouldShowLeadForm) {
      appendMessage(wc.welcome_message, "bot", messagesEl);
      if (wc.suggested_questions && wc.suggested_questions.length > 0) {
        appendSuggested(wc.suggested_questions, wc.primary_color, messagesEl, (text) => doSubmit(text));
      }
    }

    let ws: WebSocket | null = null;

    function connectWebSocket(convId: string) {
      if (ws) return;
      const protocol = API_URL.startsWith("https") ? "wss" : "ws";
      const host = API_URL ? API_URL.replace(/^https?:\/\//, "") : window.location.host;
      ws = new WebSocket(`${protocol}://${host}/ws/${convId}`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id && seenMessageIds.has(data.id)) return;
          if (data.id) seenMessageIds.add(data.id);

          if (data.role === "agent") {
            appendMessage(data.content, "agent", messagesEl);
          } else if (data.role === "assistant") {
            if (currentTypingIndicator) {
              currentTypingIndicator.remove();
              currentTypingIndicator = null;
            }
            appendMessage(data.content, "bot", messagesEl);
          }
        } catch(e) {}
      };
      ws.onclose = () => { ws = null; };
    }

    if (conversationId) connectWebSocket(conversationId);

    async function doSubmit(presetText?: string) {
      const text = presetText ?? inputEl.value.trim();
      if (!text || sendBtn.disabled) return;

      if (!presetText) {
        inputEl.value = "";
        inputEl.style.height = "auto";
      }
      sendBtn.disabled = true;

      const sqWrapper = document.getElementById("cb-suggested");
      if (sqWrapper) sqWrapper.remove();

      appendMessage(text, "user", messagesEl);
      if (currentTypingIndicator) currentTypingIndicator.remove();
      currentTypingIndicator = appendTyping(messagesEl);

      try {
        const { reply, messageId } = await sendMessage(text);
        if (!ws && conversationId) connectWebSocket(conversationId);
        
        if (messageId) seenMessageIds.add(messageId);

        if (currentTypingIndicator) {
          currentTypingIndicator.remove();
          currentTypingIndicator = null;
        }

        if (reply !== "__human_mode__") {
          appendMessage(reply, "bot", messagesEl, messageId);
        }
      } catch (e: any) {
        if (currentTypingIndicator) {
          currentTypingIndicator.remove();
          currentTypingIndicator = null;
        }
        appendMessage(e.message || "Something went wrong. Please try again.", "bot", messagesEl);
      } finally {
        sendBtn.disabled = false;
        inputEl.focus();
      }
    }

    sendBtn.addEventListener("click", () => doSubmit());
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSubmit();
      }
    });

    inputEl.addEventListener("input", () => {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + "px";
    });
  }

  function appendMessage(text: string, role: "user" | "bot" | "agent", container: HTMLElement, messageId?: string): HTMLElement {
    if (messageId && seenMessageIds.has(messageId)) {
        // Find existing message with this ID if we want to replace, 
        // but for now we just return the existing one or null.
        // Our check at the call site already handles this mostly, but safety first.
        return document.createElement("div"); // Dummy
    }
    if (messageId) seenMessageIds.add(messageId);

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

  function appendSuggested(questions: string[], color: string, container: HTMLElement, onClick: (text: string) => void) {
    const wrapper = document.createElement("div");
    wrapper.id = "cb-suggested";
    questions.filter(q => q.trim().length > 0).forEach(q => {
      const btn = document.createElement("button");
      btn.className = "cb-sq-btn";
      btn.textContent = q;
      btn.style.color = color;
      btn.onclick = () => {
        wrapper.remove();
        onClick(q);
      };
      wrapper.appendChild(btn);
    });
    if (wrapper.childNodes.length > 0) {
      container.appendChild(wrapper);
      container.scrollTop = container.scrollHeight;
    }
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

  (window as any).__cb_destroy = () => {
    document.getElementById("cb-widget")?.remove();
    delete (window as any).__cb_loaded;
    delete (window as any).__cb_destroy;
  };
})();
