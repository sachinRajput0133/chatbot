import { baseApi } from "./baseApi";

export interface UserAdminOut {
  id: string;
  email: string;
  role: string;
  role_id: string | null;
  role_name: string | null;
  must_change_password: boolean;
  is_active: boolean;
  created_at: string | null;
}

export interface InviteUserRequest {
  email: string;
  role_id: string;
}

export interface InviteUserResponse {
  user: UserAdminOut;
  invitation_email_sent: boolean;
}

export interface UpdateUserRequest {
  role_id?: string;
  is_active?: boolean;
}

export const usersApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listUsers: build.query<UserAdminOut[], void>({
      query: () => "/api/users",
      providesTags: (result) =>
        result
          ? [
              ...result.map((u) => ({ type: "Users" as const, id: u.id })),
              { type: "Users" as const, id: "LIST" },
            ]
          : [{ type: "Users" as const, id: "LIST" }],
    }),
    inviteUser: build.mutation<InviteUserResponse, InviteUserRequest>({
      query: (body) => ({ url: "/api/users/invite", method: "POST", body }),
      invalidatesTags: [{ type: "Users", id: "LIST" }, { type: "Roles", id: "LIST" }],
    }),
    updateUser: build.mutation<UserAdminOut, { id: string; data: UpdateUserRequest }>({
      query: ({ id, data }) => ({ url: `/api/users/${id}`, method: "PATCH", body: data }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Users", id: arg.id },
        { type: "Users", id: "LIST" },
        { type: "Roles", id: "LIST" },
      ],
    }),
    deleteUser: build.mutation<void, string>({
      query: (id) => ({ url: `/api/users/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Users", id: "LIST" }, { type: "Roles", id: "LIST" }],
    }),
  }),
});

export const {
  useListUsersQuery,
  useInviteUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = usersApi;
