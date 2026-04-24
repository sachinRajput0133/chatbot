import { baseApi } from "./baseApi";

export interface SlackIntegrationStatus {
  configured: boolean;
  masked_url: string | null;
}

export interface TestSlackResponse {
  ok: boolean;
  detail: string | null;
}

export interface NotificationEmailsConfig {
  primary_email: string | null;
  cc_emails: string[];
  account_email: string;
}

export interface SetNotificationEmailsInput {
  primary_email: string | null;
  cc_emails: string[];
}

export interface TestEmailResponse {
  ok: boolean;
  sent_to: string;
  cc_count: number;
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
    notificationEmails: build.query<NotificationEmailsConfig, void>({
      query: () => "/api/integrations/email-notifications",
      providesTags: ["Integrations"],
    }),
    setNotificationEmails: build.mutation<NotificationEmailsConfig, SetNotificationEmailsInput>({
      query: (body) => ({ url: "/api/integrations/email-notifications", method: "PUT", body }),
      invalidatesTags: ["Integrations"],
    }),
    testNotificationEmail: build.mutation<TestEmailResponse, void>({
      query: () => ({ url: "/api/integrations/email-notifications/test", method: "POST" }),
    }),
  }),
});

export const {
  useSlackStatusQuery,
  useSetSlackWebhookMutation,
  useDeleteSlackWebhookMutation,
  useTestSlackWebhookMutation,
  useNotificationEmailsQuery,
  useSetNotificationEmailsMutation,
  useTestNotificationEmailMutation,
} = integrationsApi;
