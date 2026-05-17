import { baseApi } from "./baseApi";

export interface AuditLogOut {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogListOut {
  items: AuditLogOut[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListAuditLogsArgs {
  limit?: number;
  offset?: number;
  action?: string;
  actor_id?: string;
}

export const auditApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    listAuditLogs: build.query<AuditLogListOut, ListAuditLogsArgs | void>({
      query: (args) => {
        const params = new URLSearchParams();
        const a = args ?? {};
        params.set("limit", String(a.limit ?? 50));
        params.set("offset", String(a.offset ?? 0));
        if (a.action) params.set("action", a.action);
        if (a.actor_id) params.set("actor_id", a.actor_id);
        return `/api/audit?${params.toString()}`;
      },
    }),
  }),
});

export const { useListAuditLogsQuery } = auditApi;
