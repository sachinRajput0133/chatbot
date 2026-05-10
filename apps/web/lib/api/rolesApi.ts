import { baseApi } from "./baseApi";

export interface PermissionEntry {
  module: string;
  action: string;
}

export interface RoleOut {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  permissions: PermissionEntry[];
  user_count: number;
  created_at: string | null;
}

export interface RoleCreate {
  name: string;
  description?: string | null;
  permissions: PermissionEntry[];
}

export interface RoleUpdate {
  name?: string;
  description?: string | null;
  permissions?: PermissionEntry[];
}

export interface PermissionRegistry {
  modules: Record<string, string[]>;
}

export const rolesApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listRoles: build.query<RoleOut[], void>({
      query: () => "/api/roles",
      providesTags: (result) =>
        result
          ? [
              ...result.map((r) => ({ type: "Roles" as const, id: r.id })),
              { type: "Roles" as const, id: "LIST" },
            ]
          : [{ type: "Roles" as const, id: "LIST" }],
    }),
    getPermissionRegistry: build.query<PermissionRegistry, void>({
      query: () => "/api/roles/permissions/registry",
    }),
    createRole: build.mutation<RoleOut, RoleCreate>({
      query: (body) => ({ url: "/api/roles", method: "POST", body }),
      invalidatesTags: [{ type: "Roles", id: "LIST" }],
    }),
    updateRole: build.mutation<RoleOut, { id: string; data: RoleUpdate }>({
      query: ({ id, data }) => ({ url: `/api/roles/${id}`, method: "PATCH", body: data }),
      invalidatesTags: (_r, _e, arg) => [
        { type: "Roles", id: arg.id },
        { type: "Roles", id: "LIST" },
      ],
    }),
    deleteRole: build.mutation<void, string>({
      query: (id) => ({ url: `/api/roles/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Roles", id: "LIST" }, { type: "Users", id: "LIST" }],
    }),
  }),
});

export const {
  useListRolesQuery,
  useGetPermissionRegistryQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} = rolesApi;
