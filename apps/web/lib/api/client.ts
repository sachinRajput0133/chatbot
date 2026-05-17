/**
 * Legacy fetch client — used by dashboard pages that haven't migrated to RTK Query hooks yet.
 * Reads auth token from localStorage directly.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cb_token");
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new ApiError(err.detail || "Request failed", res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  signup: (data: { business_name: string; email: string; password: string; country: string }) =>
    request<{ access_token: string }>("/api/auth/signup", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<{ access_token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),

  googleAuth: (data: { credential: string; country?: string; business_name?: string }) =>
    request<{ access_token: string }>("/api/auth/google", { method: "POST", body: JSON.stringify(data) }),

  me: () => request<{ user: any; tenant: any }>("/api/auth/me"),

  listDocuments: () => request<any[]>("/api/knowledge/"),

  uploadDocument: (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append("file", file);
    return fetch(`${API_URL}/api/knowledge/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then((r) => r.json());
  },

  addManualKnowledge: (data: { title: string; content: string }) =>
    request<any>("/api/knowledge/manual", { method: "POST", body: JSON.stringify(data) }),

  deleteDocument: (id: string) => request<void>(`/api/knowledge/${id}`, { method: "DELETE" }),

  getDocumentContent: (id: string) =>
    request<{ id: string; title: string; content: string }>(`/api/knowledge/${id}/content`),

  updateManualDocument: (id: string, data: { title: string; content: string }) =>
    request<any>(`/api/knowledge/${id}`, { method: "PUT", body: JSON.stringify(data) }),

  addFAQKnowledge: (items: { question: string; answer: string }[]) =>
    request<any[]>("/api/knowledge/faq", { method: "POST", body: JSON.stringify({ items }) }),

  crawlURL: (url: string) =>
    request<any>("/api/knowledge/crawl", { method: "POST", body: JSON.stringify({ url }) }),

  getLeadConfig: () => request<any>("/api/lead-capture/config"),

  updateLeadConfig: (data: any) =>
    request<any>("/api/lead-capture/config", { method: "PUT", body: JSON.stringify(data) }),

  getWidgetConfig: () => request<any>("/api/widget/config"),

  updateWidgetConfig: (data: any) =>
    request<any>("/api/widget/config", { method: "PUT", body: JSON.stringify(data) }),

  listConversations: (page = 1, status?: string, assignedTo?: string) => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (assignedTo) params.set("assigned_to", assignedTo);
    return request<any[]>(`/api/conversations/?${params.toString()}`);
  },

  listMembers: () => request<{ id: string; email: string }[]>("/api/members"),

  assignConversation: (conversationId: string, userId: string | null) =>
    request<any>(`/api/conversations/${conversationId}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ user_id: userId }),
    }),

  getConversation: (conversationId: string) =>
    request<any>(`/api/conversations/${conversationId}`),

  getMessages: (conversationId: string, before?: string) =>
    request<{ messages: any[]; has_more: boolean; next_cursor: string | null }>(
      `/api/conversations/${conversationId}/messages${before ? `?before=${before}` : ""}`
    ),

  setConversationMode: (conversationId: string, mode: "ai" | "human") =>
    request<any>(`/api/conversations/${conversationId}/mode`, {
      method: "PATCH",
      body: JSON.stringify({ mode }),
    }),

  setConversationStatus: (
    conversationId: string,
    status: "open" | "pending" | "resolved" | "closed",
  ) =>
    request<any>(`/api/conversations/${conversationId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  sendAgentReply: (conversationId: string, message: string) =>
    request<any>(`/api/conversations/${conversationId}/agent-reply`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  markAsRead: (conversationId: string) =>
    request<void>(`/api/conversations/${conversationId}/read`, { method: "POST" }),

  sendInternalNote: (conversationId: string, content: string) =>
    request<any>(`/api/conversations/${conversationId}/messages/note`, {
      method: "POST",
      body: JSON.stringify({ content }),
    }),

  updateConversationTags: (conversationId: string, tags: string[]) =>
    request<any>(`/api/conversations/${conversationId}/tags`, {
      method: "PUT",
      body: JSON.stringify({ tags }),
    }),

  getAnalytics: () => request<any>("/api/analytics/summary"),

  getUnansweredQuestions: (days = 30, limit = 20) =>
    request<{
      question: string;
      count: number;
      last_asked: string;
      sample_conversation_id: string;
    }[]>(`/api/analytics/unanswered?days=${days}&limit=${limit}`),

  getConversationRating: (conversationId: string) =>
    request<{ id: string; conversation_id: string; rating: number; comment: string | null; created_at: string } | null>(
      `/api/conversations/${conversationId}/rating`
    ),

  createCheckout: (plan: string) =>
    request<{
      gateway: string;
      checkout_url?: string;       // Stripe
      subscription_id?: string;    // Razorpay | Dodo
      key_id?: string;             // Razorpay
      payment_link?: string;       // Dodo — hosted checkout redirect URL
      client_secret?: string;      // Dodo — embedded checkout
    }>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),

  verifyRazorpayPayment: (data: {
    payment_id: string;
    subscription_id: string;
    signature: string;
    plan: string;
  }) =>
    request<{ status: string; plan: string }>("/api/billing/verify-razorpay", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  verifyDodoPayment: (data: {
    payment_id: string;
    subscription_id: string;
    plan: string;
  }) =>
    request<{ status: string; plan: string }>("/api/billing/verify-dodo", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getSubscription: () => request<any>("/api/billing/subscription"),

  cancelSubscription: () =>
    request<{ status: string }>("/api/billing/cancel", { method: "POST" }),

  getGoals: () => request<any[]>("/api/goals"),
  createGoal: (data: any) =>
    request<any>("/api/goals", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteGoal: (goalId: string) =>
    request<{ status: string }>(`/api/goals/${goalId}`, { method: "DELETE" }),

  getApiKeys: () => request<any[]>("/api/api-keys"),
  createApiKey: (data: { name: string }) =>
    request<any>("/api/api-keys", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteApiKey: (keyId: string) =>
    request<{ status: string }>(`/api/api-keys/${keyId}`, { method: "DELETE" }),

  conversationExportUrl: (conversationId: string, format: "csv" | "pdf") =>
    `${API_URL}/api/conversations/${conversationId}/export.${format}`,

  downloadConversationExport: async (conversationId: string, format: "csv" | "pdf") => {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/conversations/${conversationId}/export.${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError("Failed to download transcript", res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${conversationId}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  emailConversationTranscript: (conversationId: string, toEmail: string) =>
    request<{ status: string; to_email: string }>(
      `/api/conversations/${conversationId}/email-transcript`,
      { method: "POST", body: JSON.stringify({ to_email: toEmail }) },
    ),

  downloadLeadCsv: async (opts?: { from?: string; to?: string }) => {
    const token = getToken();
    const params = new URLSearchParams();
    if (opts?.from) params.set("from", opts.from);
    if (opts?.to) params.set("to", opts.to);
    const qs = params.toString();
    const res = await fetch(
      `${API_URL}/api/lead-capture/export.csv${qs ? `?${qs}` : ""}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (!res.ok) throw new ApiError("Failed to download leads CSV", res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const today = new Date().toISOString().slice(0, 10);
    a.download = `leads-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

/** Save token to localStorage + Redux store (if available) */
export function saveToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("cb_token", token);
  }
}

/** Clear auth from localStorage */
export function clearToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("cb_token");
    localStorage.removeItem("cb_user");
  }
}
