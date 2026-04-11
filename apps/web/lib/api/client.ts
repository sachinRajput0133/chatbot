/**
 * Legacy fetch client — used by dashboard pages that haven't migrated to RTK Query hooks yet.
 * Reads auth token from localStorage directly.
 */
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

  getWidgetConfig: () => request<any>("/api/widget/config"),

  updateWidgetConfig: (data: any) =>
    request<any>("/api/widget/config", { method: "PUT", body: JSON.stringify(data) }),

  listConversations: (page = 1) => request<any[]>(`/api/conversations/?page=${page}`),

  getMessages: (conversationId: string) =>
    request<any[]>(`/api/conversations/${conversationId}/messages`),

  getAnalytics: () => request<any>("/api/analytics/summary"),

  createCheckout: (plan: string) =>
    request<{
      gateway: string;
      checkout_url?: string;       // Stripe
      subscription_id?: string;    // Razorpay
      key_id?: string;             // Razorpay
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

  getSubscription: () => request<any>("/api/billing/subscription"),

  cancelSubscription: () =>
    request<{ status: string }>("/api/billing/cancel", { method: "POST" }),
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
