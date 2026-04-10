import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
  is_google_user?: boolean;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  tenant: {
    id: string;
    business_name: string;
    email: string;
    bot_id: string;
    plan: string;
    country: string;
    message_count_month: number;
  } | null;
}

function loadToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cb_token");
}

function loadUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("cb_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const initialState: AuthState = {
  token: loadToken(),
  user: loadUser(),
  tenant: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<{ token: string; user: AuthUser }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      if (typeof window !== "undefined") {
        localStorage.setItem("cb_token", action.payload.token);
        localStorage.setItem("cb_user", JSON.stringify(action.payload.user));
      }
    },
    setTenant(state, action: PayloadAction<AuthState["tenant"]>) {
      state.tenant = action.payload;
    },
    clearAuth(state) {
      state.token = null;
      state.user = null;
      state.tenant = null;
      if (typeof window !== "undefined") {
        localStorage.removeItem("cb_token");
        localStorage.removeItem("cb_user");
      }
    },
  },
});

export const { setAuth, setTenant, clearAuth } = authSlice.actions;
export default authSlice.reducer;
