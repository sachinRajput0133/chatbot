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
  default_language?: string | null;
  lead_capture: LeadCaptureInfo;
  suggested_questions: string[];
  calendly_url?: string;
  proactive_message?: string;
  proactive_delay?: number;
  proactive_exit_intent?: boolean;
  theme?: string;
  url_targeting_mode?: "all" | "include" | "exclude";
  url_targeting_patterns?: string[];
}

/**
 * Convert a glob-style pattern (with `*` wildcards) to a RegExp anchored at start/end.
 * Other regex metacharacters are escaped so user patterns behave literally.
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + escaped + "$");
}

function shouldShowOnCurrentUrl(
  mode: "all" | "include" | "exclude" | undefined,
  patterns: string[] | undefined,
  pathname: string,
): boolean {
  const m = mode || "all";
  if (m === "all") return true;
  const pats = (patterns || []).filter((p) => p && p.trim().length > 0);
  if (pats.length === 0) {
    // include with no patterns => show nowhere; exclude with no patterns => show everywhere
    return m === "exclude";
  }
  const matches = pats.some((p) => {
    try {
      return globToRegex(p).test(pathname);
    } catch {
      return false;
    }
  });
  return m === "include" ? matches : !matches;
}

const i18n: Record<string, Record<string, string>> = {
  en: {
    ask_anything: "Ask me anything...",
    start_new: "Start a new chat",
    end_chat: "End chat",
    view_recent: "View recent chats",
    recent_chats: "Recent chats",
    no_recent: "No recent chats found.",
    loading: "Loading...",
    start_chat: "Start Chat",
    skip: "Skip for now",
    saving: "Saving...",
    powered_by: "Powered by ChatBot AI",
    failed_history: "Failed to load history.",
    your_name: "Your Name",
    email_addr: "Email Address",
    phone_num: "Phone Number",
    mailing_addr: "Mailing Address",
    err_email: "Please enter a valid email address.",
    err_generic: "Something went wrong. Please try again."
  },
  es: {
    ask_anything: "Pregúntame cualquier cosa...",
    start_new: "Iniciar nuevo chat",
    end_chat: "Finalizar chat",
    view_recent: "Ver chats recientes",
    recent_chats: "Chats recientes",
    no_recent: "No se encontraron chats recientes.",
    loading: "Cargando...",
    start_chat: "Iniciar chat",
    skip: "Omitir por ahora",
    saving: "Guardando...",
    powered_by: "Desarrollado por ChatBot AI",
    failed_history: "Error al cargar el historial.",
    your_name: "Tu nombre",
    email_addr: "Correo electrónico",
    phone_num: "Número de teléfono",
    mailing_addr: "Dirección postal",
    err_email: "Ingresa un correo electrónico válido.",
    err_generic: "Algo salió mal. Inténtalo de nuevo."
  },
  fr: {
    ask_anything: "Posez-moi une question...",
    start_new: "Nouvelle discussion",
    end_chat: "Terminer la discussion",
    view_recent: "Discussions récentes",
    recent_chats: "Discussions récentes",
    no_recent: "Aucune discussion récente.",
    loading: "Chargement...",
    start_chat: "Démarrer la discussion",
    skip: "Passer pour l'instant",
    saving: "Enregistrement...",
    powered_by: "Propulsé par ChatBot AI",
    failed_history: "Impossible de charger l'historique.",
    your_name: "Votre nom",
    email_addr: "Adresse e-mail",
    phone_num: "Numéro de téléphone",
    mailing_addr: "Adresse postale",
    err_email: "Veuillez entrer un e-mail valide.",
    err_generic: "Une erreur est survenue. Veuillez réessayer."
  }
};


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

  function t(key: string): string {
    const override = widgetConfig?.default_language;
    let l = override && override !== "en" ? override : (navigator.language || "en").split("-")[0];
    if (!i18n[l]) l = "en";
    return i18n[l][key] || i18n["en"][key] || key;
  }

  // ── Send message ───────────────────────────────────────────────────────────
  async function sendMessage(message: string, attachmentUrl: string | null = null): Promise<{ reply: string; messageId: string }> {
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
        attachment_url: attachmentUrl,
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
  function injectStyles(color: string, theme: string = 'light') {
    const isAuto = theme === 'auto';
    const isDark = theme === 'dark';
    
    const style = document.createElement("style");
    style.textContent = `
      #cb-widget {
        --cb-bg: #ffffff;
        --cb-text: #18181b;
        --cb-text-muted: #71717a;
        --cb-border: #e4e4e7;
        --cb-msg-bot-bg: #f4f4f5;
        --cb-msg-bot-text: #18181b;
        --cb-input-bg: #f9fafb;
        --cb-history-item-hover: #fafafa;
      }
      
      ${isDark ? `
      #cb-widget {
        --cb-bg: #18181b;
        --cb-text: #f4f4f5;
        --cb-text-muted: #a1a1aa;
        --cb-border: #27272a;
        --cb-msg-bot-bg: #27272a;
        --cb-msg-bot-text: #f4f4f5;
        --cb-input-bg: #09090b;
        --cb-history-item-hover: #27272a;
      }` : ''}
      
      ${isAuto ? `
      @media (prefers-color-scheme: dark) {
        #cb-widget {
          --cb-bg: #18181b;
          --cb-text: #f4f4f5;
          --cb-text-muted: #a1a1aa;
          --cb-border: #27272a;
          --cb-msg-bot-bg: #27272a;
          --cb-msg-bot-text: #f4f4f5;
          --cb-input-bg: #09090b;
          --cb-history-item-hover: #27272a;
        }
      }` : ''}

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
        background: var(--cb-bg); border-radius: 16px; display: flex; flex-direction: column;
        box-shadow: 0 8px 32px rgba(0,0,0,0.15); z-index: 999999;
        overflow: hidden; transition: opacity 0.2s, transform 0.2s;
        border: 1px solid var(--cb-border);
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
        position: absolute; top: calc(100% + 8px); right: 0; background: var(--cb-bg); border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15); padding: 8px 0; min-width: 180px;
        display: none; flex-direction: column; z-index: 1000; border: 1px solid var(--cb-border);
      }
      #cb-menu.cb-open { display: flex; }
      .cb-menu-item {
        padding: 10px 16px; font-size: 13px; color: var(--cb-text); background: none; border: none;
        text-align: left; cursor: pointer; display: flex; align-items: center; gap: 8px; width: 100%;
      }
      .cb-menu-item:hover { background: var(--cb-msg-bot-bg); }
      
      #cb-history-view {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: var(--cb-bg); z-index: 9999; display: flex; flex-direction: column;
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
        padding: 14px; border-radius: 12px; border: 1px solid var(--cb-border); cursor: pointer;
        transition: border-color 0.2s; background: var(--cb-bg);
      }
      .cb-history-item:hover { border-color: #a1a1aa; background: var(--cb-history-item-hover); }
      .cb-hi-top { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; }
      .cb-hi-title { font-weight: 600; color: var(--cb-text); }
      .cb-hi-time { color: var(--cb-text-muted); }
      .cb-hi-msg { font-size: 13px; color: var(--cb-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.4; }
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
      .cb-msg.cb-bot { background: var(--cb-msg-bot-bg); color: var(--cb-msg-bot-text); align-self: flex-start; border-radius: 12px 12px 12px 4px; }
      .cb-msg.cb-agent { background: #4f46e5; color: white; align-self: flex-start; border-radius: 12px 12px 12px 4px; border: 1px solid #4338ca; }
      .cb-typing { display: flex; gap: 4px; align-items: center; padding: 12px; box-shadow: none; background: transparent; }
      .cb-dot { width: 6px; height: 6px; border-radius: 50%; background: #9ca3af; animation: cb-bounce 1.2s infinite; }
      .cb-dot:nth-child(2) { animation-delay: 0.2s; }
      .cb-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes cb-bounce { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }
      #cb-input-wrapper {
        display: flex; align-items: center; gap: 8px; background: var(--cb-input-bg);
        border: 1px solid var(--cb-border); border-radius: 9999px; padding: 8px 8px 8px 16px; margin: 12px;
      }
      #cb-input {
        flex: 1; border: none; background: transparent; font-size: 14px;
        outline: none; padding: 4px 0; color: var(--cb-text);
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
        display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--cb-text-muted);
        background: var(--cb-msg-bot-bg); padding: 4px 8px; border-radius: 6px; text-decoration: none; font-weight: 500;
      }
      #cb-suggested { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; margin-top: auto; padding-top: 12px; }
      .cb-sq-btn { 
        background: var(--cb-bg); border: 1px solid var(--cb-border); border-radius: 20px; 
        padding: 8px 16px; font-size: 14px; font-weight: normal; color: var(--cb-text); cursor: pointer; 
        transition: background-color 0.2s; display: inline-block;
      }
      .cb-sq-btn:hover { background: var(--cb-history-item-hover); }

      /* ── Lead capture form ──────────────────────────────────────────────── */
      #cb-lead-form {
        flex: 1; overflow-y: auto; padding: 20px 16px; display: flex;
        flex-direction: column; gap: 14px;
      }
      #cb-lead-form .cb-lf-title { font-size: 15px; font-weight: 600; color: var(--cb-text); margin: 0; }
      #cb-lead-form .cb-lf-sub { font-size: 13px; color: var(--cb-text-muted); margin: 0; line-height: 1.45; }
      #cb-lead-form .cb-lf-fields { display: flex; flex-direction: column; gap: 10px; }
      #cb-lead-form .cb-lf-field { display: flex; flex-direction: column; gap: 4px; }
      #cb-lead-form .cb-lf-field label { font-size: 12px; font-weight: 500; color: var(--cb-text-muted); }
      #cb-lead-form .cb-lf-field input {
        background: var(--cb-bg); color: var(--cb-text);
        border: 1px solid var(--cb-border); border-radius: 8px; padding: 9px 12px;
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
        background: none; border: none; font-size: 12px; color: var(--cb-text-muted);
        cursor: pointer; text-decoration: underline; text-align: center; padding: 0;
      }
      #cb-lead-form .cb-lf-error { font-size: 12px; color: #e53e3e; }

      @media (max-width: 640px) {
        #cb-panel {
          width: 100% !important;
          height: 100% !important;
          max-height: 100% !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          border-radius: 0 !important;
          margin: 0 !important;
          border: none !important;
        }
        #cb-panel.cb-hidden {
          transform: translateY(100%);
        }
        #cb-rating-overlay {
          position: absolute; inset: 0; background: rgba(255,255,255,0.97);
          display: none; flex-direction: column; align-items: stretch;
          justify-content: center; padding: 24px; z-index: 10;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        #cb-rating-overlay.cb-active { display: flex; }
        #cb-rating-overlay h3 { margin: 0 0 6px; font-size: 16px; font-weight: 700; color: #111827; text-align: center; }
        #cb-rating-overlay p { margin: 0 0 16px; font-size: 13px; color: #6b7280; text-align: center; }
        #cb-rating-stars { display: flex; justify-content: center; gap: 6px; margin-bottom: 14px; }
        #cb-rating-stars button {
          background: transparent; border: none; cursor: pointer;
          font-size: 32px; line-height: 1; color: #d1d5db; padding: 4px; transition: transform 0.1s;
        }
        #cb-rating-stars button:hover { transform: scale(1.15); }
        #cb-rating-stars button.cb-star-on { color: #f59e0b; }
        #cb-rating-comment {
          width: 100%; box-sizing: border-box; min-height: 70px; resize: vertical;
          padding: 10px 12px; border: 1px solid #e5e7eb; border-radius: 8px;
          font-size: 13px; font-family: inherit; margin-bottom: 12px;
        }
        #cb-rating-actions { display: flex; gap: 8px; }
        #cb-rating-actions button {
          flex: 1; padding: 10px 14px; border-radius: 8px; font-size: 13px;
          font-weight: 600; cursor: pointer; border: 1px solid transparent;
        }
        #cb-rating-skip { background: white; border-color: #e5e7eb !important; color: #6b7280; }
        #cb-rating-submit { background: var(--cb-color, #6366f1); color: white; }
        #cb-rating-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        #cb-rating-thanks { text-align: center; font-size: 14px; color: #059669; padding: 16px 0; display: none; }
        #cb-rating-overlay.cb-done #cb-rating-stars,
        #cb-rating-overlay.cb-done #cb-rating-comment,
        #cb-rating-overlay.cb-done #cb-rating-actions,
        #cb-rating-overlay.cb-done h3,
        #cb-rating-overlay.cb-done p { display: none; }
        #cb-rating-overlay.cb-done #cb-rating-thanks { display: block; }
        #cb-bubble.cb-hidden-mobile {
          display: none !important;
        }
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
    if (lc.collect_name) fields.push({ id: "cb-lf-name", label: t("your_name"), type: "text", placeholder: "Jane Smith" });
    if (lc.collect_email) fields.push({ id: "cb-lf-email", label: t("email_addr"), type: "email", placeholder: "jane@example.com" });
    if (lc.collect_phone) fields.push({ id: "cb-lf-phone", label: t("phone_num"), type: "tel", placeholder: "+1 555 000 0000" });
    if (lc.collect_address) fields.push({ id: "cb-lf-address", label: t("mailing_addr"), type: "text", placeholder: "123 Main St, City, State" });

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
      <button class="cb-lf-submit">${t("start_chat")}</button>
      <button class="cb-lf-skip">${t("skip")}</button>
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
        errorEl.textContent = t("err_email");
        errorEl.style.display = "";
        return;
      }
      errorEl.style.display = "none";

      submitBtn.disabled = true;
      submitBtn.textContent = t("saving");

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
                ${t("start_new")}
              </button>
              <button class="cb-menu-item" id="cb-mi-end" style="color: #ef4444;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                ${t("end_chat")}
              </button>
              <button class="cb-menu-item" id="cb-mi-history">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                ${t("view_recent")}
              </button>
            </div>
            <button id="cb-close-btn" aria-label="Close">
              <svg fill="none" height="20" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24" width="20" xmlns="http://www.w3.org/2000/svg"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>
            </button>
          </div>
        </div>
        <div id="cb-messages"></div>
        <div id="cb-rating-overlay">
          <h3>How was your chat?</h3>
          <p>Your feedback helps us improve.</p>
          <div id="cb-rating-stars" role="radiogroup" aria-label="Rate from 1 to 5 stars">
            <button type="button" data-star="1" aria-label="1 star">★</button>
            <button type="button" data-star="2" aria-label="2 stars">★</button>
            <button type="button" data-star="3" aria-label="3 stars">★</button>
            <button type="button" data-star="4" aria-label="4 stars">★</button>
            <button type="button" data-star="5" aria-label="5 stars">★</button>
          </div>
          <textarea id="cb-rating-comment" placeholder="Optional comment..." maxlength="2000"></textarea>
          <div id="cb-rating-actions">
            <button type="button" id="cb-rating-skip">Skip</button>
            <button type="button" id="cb-rating-submit" disabled>Submit</button>
          </div>
          <div id="cb-rating-thanks">Thanks for your feedback! 🙏</div>
        </div>
        <div id="cb-powered">
          <a href="#" target="_blank">${t("powered_by")}</a>
        </div>
        <div id="cb-input-container" style="border-top: 1px solid #f3f4f6; flex-shrink: 0; background: white;">
          <div id="cb-attachment-preview" style="display: none; padding: 8px 12px; font-size: 12px; color: #4b5563; background: #f9fafb; border-bottom: 1px solid #e5e7eb; align-items: center; justify-content: space-between;">
            <span id="cb-attachment-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90%;"></span>
            <button id="cb-attachment-clear" style="background:transparent; border:none; color:#ef4444; cursor:pointer;">&times;</button>
          </div>
          <div id="cb-input-wrapper">
            <button id="cb-attach" aria-label="Attach file" style="color: #9ca3af; padding: 4px; background: transparent; border: none; cursor: pointer; display: flex; align-items: center; margin-right: 4px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            </button>
            <input type="file" id="cb-file-input" style="display: none;" accept="image/*,application/pdf">
            <input type="text" id="cb-input" placeholder="${t("ask_anything")}" maxlength="1000">
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
            <div style="font-weight:600; font-size:14px; flex:1; text-align:center;">${t("recent_chats")}</div>
            <button id="cb-hi-close" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" x2="6" y1="6" y2="18"></line><line x1="6" x2="18" y1="6" y2="18"></line></svg>
            </button>
          </div>
          <div class="cb-history-list" id="cb-hi-list"></div>
          <div id="cb-history-footer">
            <button class="cb-new-chat-btn" id="cb-hi-new">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg>
              ${t("start_new")}
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    function closePanel() {
      isOpen = false;
      panel.classList.add("cb-hidden");
      bubble.classList.remove("cb-hidden-mobile");
      bubble.innerHTML = `<svg viewBox="0 0 24 24" style="fill:white"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>`;
    }

    document.getElementById("cb-close-btn")!.addEventListener("click", closePanel);
    document.getElementById("cb-hi-close")!.addEventListener("click", closePanel);

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
    document.getElementById("cb-mi-end")!.addEventListener("click", () => {
      menu.classList.remove("cb-open");
      // If there's an active conversation, prompt the visitor to rate before resetting.
      // TODO: alternative trigger — listen for a server "show_rating" message type
      // pushed when an agent marks the conversation as resolved.
      if (conversationId) {
        openRatingOverlay(conversationId, () => { resetToNewChat(); historyView.classList.remove("cb-active"); });
      } else {
        resetToNewChat();
        historyView.classList.remove("cb-active");
      }
    });
    document.getElementById("cb-hi-new")!.addEventListener("click", () => { resetToNewChat(); historyView.classList.remove("cb-active"); });

    // ── CSAT rating overlay ──
    const ratingOverlay = document.getElementById("cb-rating-overlay")!;
    const ratingStarsRow = document.getElementById("cb-rating-stars")!;
    const ratingCommentEl = document.getElementById("cb-rating-comment") as HTMLTextAreaElement;
    const ratingSubmitBtn = document.getElementById("cb-rating-submit") as HTMLButtonElement;
    const ratingSkipBtn = document.getElementById("cb-rating-skip") as HTMLButtonElement;
    let currentStars = 0;
    let ratingConvId: string | null = null;
    let onRatingClose: (() => void) | null = null;

    function paintStars(n: number) {
      ratingStarsRow.querySelectorAll<HTMLButtonElement>("button").forEach((btn) => {
        const idx = Number(btn.getAttribute("data-star"));
        btn.classList.toggle("cb-star-on", idx <= n);
      });
    }

    ratingStarsRow.querySelectorAll<HTMLButtonElement>("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentStars = Number(btn.getAttribute("data-star"));
        paintStars(currentStars);
        ratingSubmitBtn.disabled = currentStars < 1;
      });
    });

    function closeRatingOverlay() {
      ratingOverlay.classList.remove("cb-active");
      ratingOverlay.classList.remove("cb-done");
      currentStars = 0;
      ratingConvId = null;
      ratingCommentEl.value = "";
      paintStars(0);
      ratingSubmitBtn.disabled = true;
      ratingSubmitBtn.textContent = "Submit";
      const cb = onRatingClose; onRatingClose = null;
      if (cb) cb();
    }

    function openRatingOverlay(convId: string, onClose: () => void) {
      ratingConvId = convId;
      onRatingClose = onClose;
      ratingOverlay.classList.add("cb-active");
    }

    ratingSkipBtn.addEventListener("click", () => { closeRatingOverlay(); });

    ratingSubmitBtn.addEventListener("click", async () => {
      if (!ratingConvId || currentStars < 1) return;
      ratingSubmitBtn.disabled = true;
      ratingSubmitBtn.textContent = "Saving...";
      try {
        await fetch(`${API_URL}/api/widget/conversations/${ratingConvId}/rating`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating: currentStars,
            comment: ratingCommentEl.value.trim() || null,
          }),
        });
      } catch (_) { /* swallow — visitor UX should not break on rating failure */ }
      ratingOverlay.classList.add("cb-done");
      setTimeout(() => { closeRatingOverlay(); }, 1500);
    });
    
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
        hiList.innerHTML = `<div style="text-align:center; padding: 20px; color: #ef4444; font-size: 13px;">\${t("failed_history")}</div>`;
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
      bubble.classList.toggle("cb-hidden-mobile", isOpen);

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

    // Proactive Chat Triggers
    let hasTriggeredProactive = false;
    function triggerProactive() {
      if (hasTriggeredProactive || isOpen) return;
      hasTriggeredProactive = true;
      bubble.click();
      if (wc.proactive_message && !shouldShowLeadForm) {
        appendMessage(wc.proactive_message, "bot", messagesEl);
      }
    }

    if (wc.proactive_delay && wc.proactive_delay > 0) {
      setTimeout(triggerProactive, wc.proactive_delay * 1000);
    }
    if (wc.proactive_exit_intent) {
      document.addEventListener("mouseleave", (e) => {
        if (e.clientY <= 0) triggerProactive();
      });
    }

    let ws: WebSocket | null = null;
    let selectedFile: File | null = null;
    let isUploading = false;

    const fileInput = document.getElementById("cb-file-input") as HTMLInputElement;
    const attachBtn = document.getElementById("cb-attach") as HTMLButtonElement;
    const attachmentPreview = document.getElementById("cb-attachment-preview")!;
    const attachmentName = document.getElementById("cb-attachment-name")!;
    const attachmentClear = document.getElementById("cb-attachment-clear")!;

    attachBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (f) {
        if (f.size > 10 * 1024 * 1024) {
          alert("File too large. Max 10MB");
          fileInput.value = "";
          return;
        }
        selectedFile = f;
        attachmentName.textContent = f.name;
        attachmentPreview.style.display = "flex";
      }
    });
    attachmentClear.addEventListener("click", () => {
      selectedFile = null;
      fileInput.value = "";
      attachmentPreview.style.display = "none";
    });

    async function uploadFile(file: File): Promise<string | null> {
      try {
        const presignRes = await fetch(`${API_URL}/api/chat/${BOT_ID}/upload-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size })
        });
        if (!presignRes.ok) return null;
        const { upload_url, file_url } = await presignRes.json();
        
        const uploadRes = await fetch(upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file
        });
        if (!uploadRes.ok) return null;
        return file_url;
      } catch {
        return null;
      }
    }

    function connectWebSocket(convId: string) {
      if (ws) return;
      const protocol = API_URL.startsWith("https") ? "wss" : "ws";
      const host = API_URL ? API_URL.replace(/^https?:\/\//, "") : window.location.host;
      ws = new WebSocket(`${protocol}://${host}/ws/${convId}`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.id && seenMessageIds.has(data.id)) return;

          if (data.role === "agent") {
            appendMessage(data.content, "agent", messagesEl, data.id, data.attachment_url);
          } else if (data.role === "assistant") {
            if (currentTypingIndicator) {
              currentTypingIndicator.remove();
              currentTypingIndicator = null;
            }
            appendMessage(data.content, "bot", messagesEl, data.id, data.attachment_url);
          }
        } catch (e) { }
      };
      ws.onclose = () => { ws = null; };
    }

    if (conversationId) connectWebSocket(conversationId);

    async function doSubmit(presetText?: string) {
      const text = presetText ?? inputEl.value.trim();
      if ((!text && !selectedFile) || sendBtn.disabled || isUploading) return;

      const sqWrapper = document.getElementById("cb-suggested");
      if (sqWrapper) sqWrapper.remove();

      let attachmentUrl: string | null = null;
      if (selectedFile) {
        isUploading = true;
        sendBtn.style.opacity = "0.5";
        attachmentUrl = await uploadFile(selectedFile);
        isUploading = false;
        sendBtn.style.opacity = "1";
        
        if (!attachmentUrl) {
          alert("Failed to upload file");
          return;
        }
      }

      if (!presetText) inputEl.value = "";
      selectedFile = null;
      fileInput.value = "";
      attachmentPreview.style.display = "none";
      sendBtn.disabled = true;

      appendMessage(text || "Sent attachment", "user", messagesEl, undefined, attachmentUrl);
      if (currentTypingIndicator) currentTypingIndicator.remove();
      currentTypingIndicator = appendTyping(messagesEl);

      try {
        const { reply, messageId } = await sendMessage(text);
        if (!ws && conversationId) connectWebSocket(conversationId);

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
        appendMessage(e.message || t("err_generic"), "bot", messagesEl);
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

  function appendMessage(text: string, role: "user" | "bot" | "agent", container: HTMLElement, messageId?: string, attachmentUrl?: string | null): HTMLElement {
    if (messageId && seenMessageIds.has(messageId)) {
      // Find existing message with this ID if we want to replace, 
      // but for now we just return the existing one or null.
      // Our check at the call site already handles this mostly, but safety first.
      return document.createElement("div"); // Dummy
    }
    if (messageId) seenMessageIds.add(messageId);

    const div = document.createElement("div");
    div.className = `cb-msg cb-${role}`;
    
    let displayHtml = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Bold: **text**
    displayHtml = displayHtml.replace(/\*\*([^\*]+)\*\*/g, '<b>$1</b>');
    
    // Italic: *text* or _text_
    displayHtml = displayHtml.replace(/\*([^\*]+)\*/g, '<i>$1</i>');
    displayHtml = displayHtml.replace(/_([^_]+)_/g, '<i>$1</i>');

    // Lists: Lines starting with - or * or • followed by space
    displayHtml = displayHtml.split('\n').map(line => {
      const trimmed = line.trim();
      if (/^[-*•]\s+/.test(trimmed)) {
        return `<div style="margin-left: 12px; display: flex; gap: 8px;"><span style="flex-shrink:0">•</span><span>${trimmed.substring(2)}</span></div>`;
      }
      return line;
    }).join('\n');

    displayHtml = displayHtml.replace(/\n/g, "<br>");
    
    // Parse Markdown links [text](url) into actual HTML links/buttons
    displayHtml = displayHtml.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, 
      '<a href="$2" target="_blank" style="display:inline-block; margin-top:8px; padding:8px 16px; background-color:rgba(0,0,0,0.1); border-radius:16px; text-decoration:none; font-weight:bold; color:inherit;">$1</a>'
    );
    
    if (attachmentUrl) {
      displayHtml += `<br><br><a href="${attachmentUrl.replace(/"/g, '&quot;')}" target="_blank" style="font-size:12px; text-decoration:underline; color: inherit;">[Attached File]</a>`;
    }
    
    div.innerHTML = displayHtml;
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
      // URL-based targeting: skip rendering entirely if current page is excluded
      if (
        !shouldShowOnCurrentUrl(
          widgetConfig.url_targeting_mode,
          widgetConfig.url_targeting_patterns,
          window.location.pathname,
        )
      ) {
        return;
      }
      injectStyles(widgetConfig.primary_color, widgetConfig.theme);
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
