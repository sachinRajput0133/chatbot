import { baseApi } from "./baseApi";

export interface Conversation {
  id: string;
  visitor_id: string;
  page_url: string | null;
  started_at: string;
  last_message_at: string;
  message_count: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  tokens_used: number | null;
  created_at: string;
}

export const conversationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listConversations: build.query<Conversation[], number>({
      query: (page = 1) => `/api/conversations/?page=${page}`,
      providesTags: ["Conversations"],
    }),
    getMessages: build.query<Message[], string>({
      query: (conversationId) => `/api/conversations/${conversationId}/messages`,
      providesTags: (_result, _err, id) => [{ type: "Messages", id }],
    }),
  }),
});

export const { useListConversationsQuery, useGetMessagesQuery } = conversationsApi;
