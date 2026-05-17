import { baseApi } from "./baseApi";

export interface CannedResponseOut {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CannedResponseIn {
  shortcut: string;
  title: string;
  content: string;
}

export interface CannedResponseUpdate {
  shortcut?: string;
  title?: string;
  content?: string;
}

const TAG = { type: "Conversations" as const, id: "CANNED_RESPONSES" };

export const cannedResponsesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listCannedResponses: build.query<CannedResponseOut[], void>({
      query: () => "/api/canned-responses",
      providesTags: [TAG],
    }),
    createCannedResponse: build.mutation<CannedResponseOut, CannedResponseIn>({
      query: (body) => ({
        url: "/api/canned-responses",
        method: "POST",
        body,
      }),
      invalidatesTags: [TAG],
    }),
    updateCannedResponse: build.mutation<
      CannedResponseOut,
      { id: string; patch: CannedResponseUpdate }
    >({
      query: ({ id, patch }) => ({
        url: `/api/canned-responses/${id}`,
        method: "PUT",
        body: patch,
      }),
      invalidatesTags: [TAG],
    }),
    deleteCannedResponse: build.mutation<void, string>({
      query: (id) => ({
        url: `/api/canned-responses/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: [TAG],
    }),
  }),
});

export const {
  useListCannedResponsesQuery,
  useCreateCannedResponseMutation,
  useUpdateCannedResponseMutation,
  useDeleteCannedResponseMutation,
} = cannedResponsesApi;
