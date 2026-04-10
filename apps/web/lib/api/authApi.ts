import { baseApi } from "./baseApi";

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface UserOut {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
  is_google_user: boolean;
  created_at: string | null;
}

export interface TenantOut {
  id: string;
  business_name: string;
  email: string;
  bot_id: string;
  plan: string;
  country: string;
  message_count_month: number;
  created_at: string | null;
}

export interface MeResponse {
  user: UserOut;
  tenant: TenantOut;
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    signup: build.mutation<AuthResponse, { business_name: string; email: string; password: string; country: string }>({
      query: (body) => ({ url: "/api/auth/signup", method: "POST", body }),
    }),
    login: build.mutation<AuthResponse, { email: string; password: string }>({
      query: (body) => ({ url: "/api/auth/login", method: "POST", body }),
    }),
    googleAuth: build.mutation<AuthResponse, { credential: string; country?: string; business_name?: string }>({
      query: (body) => ({ url: "/api/auth/google", method: "POST", body }),
    }),
    me: build.query<MeResponse, void>({
      query: () => "/api/auth/me",
      providesTags: ["Profile"],
    }),
    updateProfile: build.mutation<MeResponse, { business_name?: string; country?: string }>({
      query: (body) => ({ url: "/api/auth/profile", method: "PUT", body }),
      invalidatesTags: ["Profile"],
    }),
    changePassword: build.mutation<void, { current_password: string; new_password: string }>({
      query: (body) => ({ url: "/api/auth/change-password", method: "PUT", body }),
    }),
  }),
});

export const {
  useSignupMutation,
  useLoginMutation,
  useGoogleAuthMutation,
  useMeQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
} = authApi;
