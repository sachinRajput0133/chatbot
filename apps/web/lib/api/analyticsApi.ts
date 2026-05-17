import { baseApi } from "./baseApi";

export interface AnalyticsSummary {
  total_conversations: number;
  total_messages: number;
  messages_this_month: number;
  avg_messages_per_chat: number;
}

export interface UnansweredQuestion {
  question: string;
  count: number;
  last_asked: string;
  sample_conversation_id: string;
}

export const analyticsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAnalytics: build.query<AnalyticsSummary, void>({
      query: () => "/api/analytics/summary",
      providesTags: ["Analytics"],
    }),
    getUnansweredQuestions: build.query<
      UnansweredQuestion[],
      { days?: number; limit?: number } | void
    >({
      query: (args) => {
        const days = args?.days ?? 30;
        const limit = args?.limit ?? 20;
        return `/api/analytics/unanswered?days=${days}&limit=${limit}`;
      },
      providesTags: ["Analytics"],
    }),
  }),
});

export const { useGetAnalyticsQuery, useGetUnansweredQuestionsQuery } = analyticsApi;
