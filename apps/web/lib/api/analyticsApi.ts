import { baseApi } from "./baseApi";

export interface AnalyticsSummary {
  total_conversations: number;
  total_messages: number;
  messages_this_month: number;
  avg_messages_per_chat: number;
}

export const analyticsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAnalytics: build.query<AnalyticsSummary, void>({
      query: () => "/api/analytics/summary",
      providesTags: ["Analytics"],
    }),
  }),
});

export const { useGetAnalyticsQuery } = analyticsApi;
