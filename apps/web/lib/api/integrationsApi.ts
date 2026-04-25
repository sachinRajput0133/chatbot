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

export interface AlertKeywordsConfig {
  keywords: string[];
  max_keywords: number;
}

export interface TestWhatsAppResponse {
  ok: boolean;
  detail: string | null;
  delivered_to: number;
}

export interface WhatsAppIntegrationStatus {
  configured: boolean;
  masked_phone_id: string | null;
  recipient_count: number;
}

export interface WhatsAppRecipientsConfig {
  phones: string[];
  max_recipients: number;
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
    alertKeywords: build.query<AlertKeywordsConfig, void>({
      query: () => "/api/integrations/alert-keywords",
      providesTags: ["Integrations"],
    }),
    setAlertKeywords: build.mutation<AlertKeywordsConfig, { keywords: string[] }>({
      query: (body) => ({ url: "/api/integrations/alert-keywords", method: "PUT", body }),
      invalidatesTags: ["Integrations"],
    }),
    whatsappStatus: build.query<WhatsAppIntegrationStatus, void>({
      query: () => "/api/integrations/whatsapp",
      providesTags: ["Integrations"],
    }),
    setWhatsAppConfig: build.mutation<WhatsAppIntegrationStatus, { phone_number_id: string; access_token: string }>({
      query: (body) => ({ url: "/api/integrations/whatsapp", method: "PUT", body }),
      invalidatesTags: ["Integrations"],
    }),
    deleteWhatsAppConfig: build.mutation<void, void>({
      query: () => ({ url: "/api/integrations/whatsapp", method: "DELETE" }),
      invalidatesTags: ["Integrations"],
    }),
    whatsappRecipients: build.query<WhatsAppRecipientsConfig, void>({
      query: () => "/api/integrations/whatsapp/recipients",
      providesTags: ["Integrations"],
    }),
    setWhatsAppRecipients: build.mutation<WhatsAppRecipientsConfig, { phones: string[] }>({
      query: (body) => ({ url: "/api/integrations/whatsapp/recipients", method: "PUT", body }),
      invalidatesTags: ["Integrations"],
    }),
    testWhatsApp: build.mutation<TestWhatsAppResponse, { phone_number_id?: string; access_token?: string; test_phone?: string }>({
      query: (body) => ({ url: "/api/integrations/whatsapp/test", method: "POST", body }),
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
  useAlertKeywordsQuery,
  useSetAlertKeywordsMutation,
  useWhatsappStatusQuery,
  useSetWhatsAppConfigMutation,
  useDeleteWhatsAppConfigMutation,
  useWhatsappRecipientsQuery,
  useSetWhatsAppRecipientsMutation,
  useTestWhatsAppMutation,
} = integrationsApi;
