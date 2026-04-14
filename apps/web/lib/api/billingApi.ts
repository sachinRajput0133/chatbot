import { baseApi } from "./baseApi";

export interface Subscription {
  id: string;
  plan: string;
  status: string;
  gateway: string;
  gateway_subscription_id: string;
  created_at: string;
  renewed_at: string | null;
}

export interface CheckoutResponse {
  checkout_url: string;
  gateway: string;
}

export const billingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    createCheckout: build.mutation<CheckoutResponse, { plan: string }>({
      query: (body) => ({ url: "/api/billing/checkout", method: "POST", body }),
    }),
    getSubscription: build.query<Subscription | null, void>({
      query: () => "/api/billing/subscription",
      providesTags: ["Billing"],
    }),
  }),
});

export const { useCreateCheckoutMutation, useGetSubscriptionQuery } = billingApi;
