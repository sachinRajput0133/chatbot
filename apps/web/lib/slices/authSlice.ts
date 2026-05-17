import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthUser {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
  is_google_user?: boolean;
  role_id?: string | null;
  role_name?: string | null;
  must_change_password?: boolean;
  permissions?: string[];
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

// initialState is intentionally empty on BOTH server and first client render
// to keep SSR markup matching pre-hydration client markup (no React hydration
// mismatch). Real auth is loaded into the store via Providers' useEffect
// after mount — see app/providers.tsx (hydrateAuthFromStorage).
const initialState: AuthState = {
  token: null,
  user: null,
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
    patchUser(state, action: PayloadAction<Partial<AuthUser>>) {
      if (!state.user) return;
      state.user = { ...state.user, ...action.payload };
      if (typeof window !== "undefined") {
        localStorage.setItem("cb_user", JSON.stringify(state.user));
      }
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

export const { setAuth, setTenant, patchUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;
