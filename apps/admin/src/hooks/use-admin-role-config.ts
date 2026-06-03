"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  AdminRoleConfigRecord,
  AdminRoleConfigsResponse,
  AdminRoleConfigResponse,
  UpdateAdminRolePermissionsInput,
} from "@cashsouk/types";
import { CURRENT_USER_QUERY_KEY } from "./use-current-user";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const ADMIN_ROLE_CONFIGS_QUERY_KEY = ["admin", "role-configs"] as const;

export function useAdminRoleConfigs() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ADMIN_ROLE_CONFIGS_QUERY_KEY,
    queryFn: async (): Promise<AdminRoleConfigRecord[]> => {
      const response = await apiClient.get<AdminRoleConfigsResponse>("/v1/admin/roles");
      if (!response.success) {
        throw new Error(response.error.message);
      }

      return response.data.roles;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useUpdateAdminRolePermissions() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      roleKey,
      data,
    }: {
      roleKey: string;
      data: UpdateAdminRolePermissionsInput;
    }): Promise<AdminRoleConfigRecord> => {
      const response = await apiClient.patch<AdminRoleConfigResponse>(
        `/v1/admin/roles/${roleKey}/permissions`,
        data
      );
      if (!response.success) {
        throw new Error(response.error.message);
      }

      return response.data.role;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_ROLE_CONFIGS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
    },
  });
}
