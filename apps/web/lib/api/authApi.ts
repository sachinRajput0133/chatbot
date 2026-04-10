import { baseApi } from "./baseApi";

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    role: string;
    tenant_id: string;
  };
  tenant: {
    id: string;
    business_name: string;
    email: string;
    bot_id: string;
    plan: string;
    country: string;
    message_count_month: number;
  };
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
  }),
});

export const {
  useSignupMutation,
  useLoginMutation,
  useGoogleAuthMutation,
  useMeQuery,
} = authApi;
