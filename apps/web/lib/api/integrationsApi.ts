import { baseApi } from "./baseApi";

export interface SlackIntegrationStatus {
  configured: boolean;
  masked_url: string | null;
}

export interface TestSlackResponse {
  ok: boolean;
  detail: string | null;
}

export const integrationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    slackStatus: build.query<SlackIntegrationStatus, void>({
      query: () => "/api/integrations/slack",
      providesTags: ["Integrations"],
    }),
    setSlackWebhook: build.mutation<SlackIntegrationStatus, { webhook_url: string }>({
      query: (body) => ({ url: "/api/integrations/slack", method: "PUT", body }),
      invalidatesTags: ["Integrations"],
    }),
    deleteSlackWebhook: build.mutation<void, void>({
      query: () => ({ url: "/api/integrations/slack", method: "DELETE" }),
      invalidatesTags: ["Integrations"],
    }),
    testSlackWebhook: build.mutation<TestSlackResponse, { webhook_url?: string }>({
      query: (body) => ({ url: "/api/integrations/slack/test", method: "POST", body }),
    }),
  }),
});

export const {
  useSlackStatusQuery,
  useSetSlackWebhookMutation,
  useDeleteSlackWebhookMutation,
  useTestSlackWebhookMutation,
} = integrationsApi;
