import { baseApi } from "./baseApi";

export interface MemberOut {
  id: string;
  email: string;
}

export const membersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listMembers: build.query<MemberOut[], void>({
      query: () => "/api/members",
      providesTags: [{ type: "Users" as const, id: "MEMBERS_LIST" }],
    }),
  }),
});

export const { useListMembersQuery } = membersApi;
