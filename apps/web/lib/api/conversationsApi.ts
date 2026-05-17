import { baseApi } from "./baseApi";

export type ConversationStatus = "open" | "pending" | "resolved" | "closed";

export interface Conversation {
  id: string;
  visitor_id: string;
  page_url: string | null;
  started_at: string;
  last_message_at: string;
  message_count: number;
  status?: ConversationStatus;
  resolved_at?: string | null;
  resolved_by_user_id?: string | null;
  lead_score?: number;
  lead_score_factors?: Record<string, number> | null;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "agent";
  content: string;
  tokens_used: number | null;
  created_at: string;
  is_internal?: boolean;
}

export interface AddNoteArgs {
  conversationId: string;
  content: string;
}

interface ListConversationsArg {
  page?: number;
  status?: string; // comma-separated statuses, e.g. "open,pending"
  sort?: "lead_score_desc";
  min_score?: number;
}

export const conversationsApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listConversations: build.query<Conversation[], ListConversationsArg | number | void>({
      query: (arg) => {
        const { page = 1, status, sort, min_score }: ListConversationsArg =
          typeof arg === "number" ? { page: arg } : (arg ?? {});
        const params = new URLSearchParams({ page: String(page) });
        if (status) params.set("status", status);
        if (sort) params.set("sort", sort);
        if (typeof min_score === "number") params.set("min_score", String(min_score));
        return `/api/conversations/?${params.toString()}`;
      },
      providesTags: ["Conversations"],
    }),
    getMessages: build.query<Message[], string>({
      query: (conversationId) => `/api/conversations/${conversationId}/messages`,
      providesTags: (_result, _err, id) => [{ type: "Messages", id }],
    }),
    addNote: build.mutation<Message, AddNoteArgs>({
      query: ({ conversationId, content }) => ({
        url: `/api/conversations/${conversationId}/messages/note`,
        method: "POST",
        body: { content },
      }),
      invalidatesTags: (_result, _err, { conversationId }) => [
        { type: "Messages", id: conversationId },
      ],
    }),
    setConversationStatus: build.mutation<
      Conversation,
      { conversationId: string; status: ConversationStatus }
    >({
      query: ({ conversationId, status }) => ({
        url: `/api/conversations/${conversationId}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: ["Conversations"],
    }),
  }),
});

export const {
  useListConversationsQuery,
  useGetMessagesQuery,
  useAddNoteMutation,
  useSetConversationStatusMutation,
} = conversationsApi;
