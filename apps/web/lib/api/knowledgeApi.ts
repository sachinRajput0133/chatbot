import { baseApi } from "./baseApi";

export interface Document {
  id: string;
  filename: string;
  file_type: string;
  status: "pending" | "processing" | "indexed" | "failed";
  chunk_count: number;
  error_message: string | null;
  created_at: string;
}

export const knowledgeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listDocuments: build.query<Document[], void>({
      query: () => "/api/knowledge/",
      providesTags: ["Knowledge"],
    }),
    uploadDocument: build.mutation<Document, FormData>({
      query: (body) => ({
        url: "/api/knowledge/upload",
        method: "POST",
        body,
        // Don't set Content-Type — browser sets multipart/form-data with boundary
        formData: true,
      }),
      invalidatesTags: ["Knowledge"],
    }),
    addManualKnowledge: build.mutation<Document, { title: string; content: string }>({
      query: (body) => ({ url: "/api/knowledge/manual", method: "POST", body }),
      invalidatesTags: ["Knowledge"],
    }),
    deleteDocument: build.mutation<void, string>({
      query: (id) => ({ url: `/api/knowledge/${id}`, method: "DELETE" }),
      invalidatesTags: ["Knowledge"],
    }),
  }),
});

export const {
  useListDocumentsQuery,
  useUploadDocumentMutation,
  useAddManualKnowledgeMutation,
  useDeleteDocumentMutation,
} = knowledgeApi;
