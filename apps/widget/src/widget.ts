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


(function () {
  // Prevent double-init (React Strict Mode / multiple script loads)
  if ((window as any).__cb_loaded) return;
  (window as any).__cb_loaded = true;

  const config: ChatbotConfig = (window as any).ChatbotConfig;
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
        position: fixed; bottom: 92px; width: 406px; height: 832px; max-height: calc(100vh - 120px);
        background: #fff; border-radius: 16px; display: flex; flex-direction: column;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15); z-index: 999999;
        overflow: hidden; transition: opacity 0.2s, transform 0.2s;
      }
      #cb-panel.cb-hidden { opacity: 0; pointer-events: none; transform: translateY(12px); }
      #cb-header {
        background: ${color}; color: white; padding: 16px 20px;
        display: flex; align-items: center; justify-content: space-between;
      }
      #cb-header .cb-avatar {
        width: 32px; height: 32px; border-radius: 50%; background: white;
        display: flex; align-items: center; justify-content: center; font-size: 14px; color: #000; font-weight: bold; flex-shrink: 0; overflow: hidden;
      }
      #cb-header .cb-title { font-weight: 600; font-size: 14px; }
      .cb-header-actions { display: flex; align-items: center; gap: 12px; position: relative; }
      .cb-header-actions > button {
        background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.8); padding: 0; display: flex;
      }
      .cb-header-actions > button:hover { color: white; }
      
      #cb-menu {
        position: absolute; top: calc(100% + 8px); right: 0; background: white; border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 8px 0; min-width: 180px;
        display: none; flex-direction: column; z-index: 1000; border: 1px solid #e4e4e7;
      }
      #cb-menu.cb-open { display: flex; }
      .cb-menu-item {
        padding: 10px 16px; font-size: 13px; color: #18181b; background: none; border: none;
        text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%;
      }
      .cb-menu-item:hover { background: #f4f4f5; }
      
      #cb-history-view {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: white; z-index: 9999; display: flex; flex-direction: column;
        transform: translateY(100%); transition: transform 0.25s ease;
      }
      #cb-history-view.cb-active { transform: translateY(0); }
      .cb-history-header {
        background: #111; color: white; padding: 16px 20px;
        display: flex; align-items: center; justify-content: space-between;
      }
      .cb-history-header button { background: none; border: none; color: white; cursor: pointer; padding: 0; display: flex; }
      .cb-history-list { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .cb-history-item {
        padding: 14px; border-radius: 12px; border: 1px solid #e4e4e7; cursor: pointer;
        transition: border-color 0.2s; background: white;
      }
      .cb-history-item:hover { border-color: #a1a1aa; background: #fafafa; }
      .cb-hi-top { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
      .cb-hi-title { font-weight: 600; color: #18181b; }
      .cb-hi-time { color: #71717a; }
      .cb-hi-msg { font-size: 13px; color: #52525b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; }
      #cb-history-footer { padding: 24px; display: flex; justify-content: center; }
      .cb-new-chat-btn {
        background: #111; color: white; border-radius: 9999px; padding: 12px 24px;
        font-size: 14px; font-weight: 500; border: none; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: opacity 0.2s;
      }
      .cb-new-chat-btn:hover { opacity: 0.8; }
      
      #cb-messages {
        flex: 1; overflow-y: auto; padding: 16px; display: flex;
        flex-direction: column; gap: 12px; scroll-behavior: smooth; font-size: 14px;
      }
      .cb-msg { max-width: 85%; padding: 12px; border-radius: 12px; line-height: 1.45; word-wrap: break-word; white-space: pre-wrap; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
      .cb-msg.cb-user { background: ${color}; color: white; align-self: flex-end; border-radius: 12px 12px 4px 12px; }
      .cb-msg.cb-bot { background: #f4f4f5; color: #18181b; align-self: flex-start; border-radius: 12px 12px 12px 4px; }
      .cb-msg.cb-agent { background: #4f46e5; color: white; align-self: flex-start; border-radius: 12px 12px 12px 4px; border: 1px solid #4338ca; }
      .cb-typing { display: flex; gap: 4px; align-items: center; padding: 12px; box-shadow: none; background: transparent; }
      .cb-dot { width: 6px; height: 6px; border-radius: 50%; background: #9ca3af; animation: cb-bounce 1.2s infinite; }
      .cb-dot:nth-child(2) { animation-delay: 0.2s; }
      .cb-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes cb-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
      #cb-input-wrapper {
        display: flex; align-items: center; gap: 8px; background: #f9fafb;
        border: 1px solid #e5e7eb; border-radius: 9999px; padding: 8px 8px 8px 16px; margin: 12px;
      }
      #cb-input {
        flex: 1; border: none; background: transparent; font-size: 14px;
        outline: none; padding: 4px 0; color: #18181b;
      }
      #cb-send {
        width: 32px; height: 32px; border-radius: 50%; background: ${color};
        border: none; cursor: pointer; display: flex; align-items: center;
        justify-content: center; flex-shrink: 0;
      }
      #cb-send:disabled { opacity: 0.5; cursor: not-allowed; }
      #cb-send svg { width: 14px; height: 14px; fill: none; stroke: white; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
      #cb-powered { display: flex; justify-content: center; padding-bottom: 8px; }
      #cb-powered a {
        display: flex; align-items: center; gap: 4px; font-size: 10px; color: #6b7280;
        background: #f3f4f6; padding: 4px 8px; border-radius: 6px; text-decoration: none; font-weight: 500;
      }
      #cb-suggested { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: auto; padding-top: 12px; }
      .cb-sq-btn { 
        background: #fff; border: 1px solid #e4e4e7; border-radius: 20px; 
        padding: 8px 16px; font-size: 14px; font-weight: normal; color: #18181b; cursor: pointer; 
        transition: background-color 0.2s; display: inline-block;
      }
      .cb-sq-btn:hover { background: #f9fafb; }

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
          <div style="display:flex; align-items:center; gap: 12px;">
            <div class="cb-avatar">${wc.avatar_url ? `<img src="${wc.avatar_url}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : wc.bot_name.charAt(0).toUpperCase()}</div>
            <div class="cb-title">${escHtml(wc.bot_name)}</div>
          </div>
          <div class="cb-header-actions">
            <button id="cb-menu-btn" aria-label="Menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
            </button>
            <div id="cb-menu">
              <button class="cb-menu-item" id="cb-mi-new">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Start a new chat
              </button>
              <button class="cb-menu-item" id="cb-mi-end" style="color: #ef4444;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                End chat
              </button>
              <button class="cb-menu-item" id="cb-mi-history">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                View recent chats
              </button>
            </div>
            <button onclick="document.getElementById('cb-panel').classList.add('cb-hidden')" aria-label="Close">
              <svg fill="none" height="20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>
            </button>
          </div>
        </div>
        <div id="cb-messages"></div>
        <div id="cb-powered">
          <a href="#" target="_blank">Powered by ChatBot AI</a>
        </div>
        <div id="cb-input-container" style="border-top: 1px solid #f3f4f6; flex-shrink: 0;">
          <div id="cb-input-wrapper">
            <input type="text" id="cb-input" placeholder="Ask me anything..." maxlength="1000">
            <button id="cb-send" aria-label="Send">
              <svg fill="none" height="14" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="14" xmlns="http://www.w3.org/2000/svg"><path d="M22 2L11 13"></path><path d="M22 2L15 22L11 13L2 9L22 2Z"></path></svg>
            </button>
          </div>
        </div>
        <div id="cb-history-view">
          <div class="cb-history-header">
            <button id="cb-hi-back" aria-label="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <div style="font-weight:600; font-size:14px; flex:1; text-align:center;">Recent chats</div>
            <button onclick="document.getElementById('cb-panel').classList.add('cb-hidden')" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>
            </button>
          </div>
          <div class="cb-history-list" id="cb-hi-list"></div>
          <div id="cb-history-footer">
            <button class="cb-new-chat-btn" id="cb-hi-new">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg>
              Start a new chat
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    const bubble = document.getElementById("cb-bubble")!;
    const panel = document.getElementById("cb-panel")!;
    const messagesEl = document.getElementById("cb-messages")!;
    const inputRow = document.getElementById("cb-input-container")!;
    const inputEl = document.getElementById("cb-input") as HTMLInputElement;
    const sendBtn = document.getElementById("cb-send") as HTMLButtonElement;
    
    const menuBtn = document.getElementById("cb-menu-btn")!;
    const menu = document.getElementById("cb-menu")!;
    const historyView = document.getElementById("cb-history-view")!;
    const hiList = document.getElementById("cb-hi-list")!;
    
    menuBtn.addEventListener("click", (e) => { e.stopPropagation(); menu.classList.toggle("cb-open"); });
    document.addEventListener("click", () => menu.classList.remove("cb-open"));

    function resetToNewChat() {
      conversationId = null;
      localStorage.removeItem(`cb_conv_${BOT_ID}`);
      seenMessageIds.clear();
      messagesEl.innerHTML = "";
      if (ws) { ws.close(); ws = null; }
      showChatView();
    }

    document.getElementById("cb-mi-new")!.addEventListener("click", () => { resetToNewChat(); historyView.classList.remove("cb-active"); });
    document.getElementById("cb-mi-end")!.addEventListener("click", () => { resetToNewChat(); historyView.classList.remove("cb-active"); });
    document.getElementById("cb-hi-new")!.addEventListener("click", () => { resetToNewChat(); historyView.classList.remove("cb-active"); });
    
    document.getElementById("cb-hi-back")!.addEventListener("click", () => historyView.classList.remove("cb-active"));

    document.getElementById("cb-mi-history")!.addEventListener("click", async () => {
      historyView.classList.add("cb-active");
      hiList.innerHTML = `<div style="text-align:center; padding: 20px; color: #71717a; font-size: 13px;">Loading...</div>`;
      try {
        const res = await fetch(`${API_URL}/api/chat/${BOT_ID}/conversations?visitor_id=${visitorId}`);
        if (!res.ok) throw new Error();
        const chats = await res.json();
        
        hiList.innerHTML = "";
        if (chats.length === 0) {
          hiList.innerHTML = `<div style="text-align:center; padding: 20px; color: #71717a; font-size: 13px;">No recent chats found.</div>`;
          return;
        }

        const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
        chats.forEach((c: any) => {
          const item = document.createElement("div");
          item.className = "cb-history-item";
          
          const dt = new Date(c.last_message_at);
          const diffHours = (dt.getTime() - Date.now()) / (1000 * 60 * 60);
          const timeStr = diffHours > -24 ? formatter.format(Math.round(diffHours), 'hour') : dt.toLocaleDateString();

          item.innerHTML = `
            <div class="cb-hi-top">
              <div class="cb-hi-title">${escHtml(c.title)}</div>
              <div class="cb-hi-time">${timeStr}</div>
            </div>
            <div class="cb-hi-msg">${escHtml(c.latest_message)}</div>
          `;
          
          item.addEventListener("click", async () => {
            historyView.classList.remove("cb-active");
            conversationId = c.id;
            setConversationId(c.id);
            seenMessageIds.clear();
            messagesEl.innerHTML = "";
            if (ws) { ws.close(); ws = null; }
            connectWebSocket(c.id);
            
            // Load messages
            const hRes = await fetch(`${API_URL}/api/chat/${BOT_ID}/history?visitor_id=${visitorId}&conversation_id=${c.id}`);
            if (hRes.ok) {
              const msgs = await hRes.json();
              msgs.forEach((m: any) => {
                appendMessage(m.content, m.role === "assistant" ? "bot" : m.role === "agent" ? "agent" : "user", messagesEl);
              });
            }
          });
          
          hiList.appendChild(item);
        });
      } catch (e) {
        hiList.innerHTML = `<div style="text-align:center; padding: 20px; color: #ef4444; font-size: 13px;">Failed to load history.</div>`;
      }
    });

    // Determine whether to show lead form on first open
    const shouldShowLeadForm =
      wc.lead_capture.enabled &&
      !isLeadSubmitted() &&
      !userInfo?.userId; // Skip form if we already have an identified user

    function showChatView() {
      // Show welcome message and focus input
      const msgLines = (wc.welcome_message || "Hi! How can I help you today?").split(/\\n+/).filter(m => m.trim().length > 0);
      msgLines.forEach(msg => appendMessage(msg, "bot", messagesEl));
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
      const msgLines = (wc.welcome_message || "Hi! How can I help you today?").split(/\\n+/).filter(m => m.trim().length > 0);
      msgLines.forEach(msg => appendMessage(msg, "bot", messagesEl));
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
        } catch (e) { }
      };
      ws.onclose = () => { ws = null; };
    }

    if (conversationId) connectWebSocket(conversationId);

    async function doSubmit(presetText?: string) {
      const text = presetText ?? inputEl.value.trim();
      if (!text || sendBtn.disabled) return;

      if (!presetText) {
        inputEl.value = "";
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
