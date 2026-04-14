import { baseApi } from "./baseApi";

export interface WidgetConfig {
  bot_name: string;
  primary_color: string;
  welcome_message: string;
  position: "bottom-right" | "bottom-left";
  avatar_url: string | null;
  system_prompt: string | null;
}

export const widgetApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getWidgetConfig: build.query<WidgetConfig, void>({
      query: () => "/api/widget/config",
      providesTags: ["WidgetConfig"],
    }),
    updateWidgetConfig: build.mutation<WidgetConfig, Partial<WidgetConfig>>({
      query: (body) => ({ url: "/api/widget/config", method: "PUT", body }),
      invalidatesTags: ["WidgetConfig"],
    }),
  }),
});

export const { useGetWidgetConfigQuery, useUpdateWidgetConfigMutation } = widgetApi;
