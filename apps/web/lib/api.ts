const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cb_token");
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
    throw new Error(err.detail || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Auth
  signup: (data: { business_name: string; email: string; password: string; country: string }) =>
    request<{ access_token: string }>("/api/auth/signup", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<{ access_token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),

  me: () => request<{ user: any; tenant: any }>("/api/auth/me"),

  // Knowledge
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

  // Widget config
  getWidgetConfig: () => request<any>("/api/widget/config"),
  updateWidgetConfig: (data: any) =>
    request<any>("/api/widget/config", { method: "PUT", body: JSON.stringify(data) }),

  // Conversations
  listConversations: (page = 1) => request<any[]>(`/api/conversations/?page=${page}`),
  getMessages: (conversationId: string) => request<any[]>(`/api/conversations/${conversationId}/messages`),

  // Analytics
  getAnalytics: () => request<any>("/api/analytics/summary"),

  // Billing
  createCheckout: (plan: string) =>
    request<{ checkout_url: string; gateway: string }>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }),

  getSubscription: () => request<any>("/api/billing/subscription"),
};

export function saveToken(token: string) {
  localStorage.setItem("cb_token", token);
}

export function clearToken() {
  localStorage.removeItem("cb_token");
}
