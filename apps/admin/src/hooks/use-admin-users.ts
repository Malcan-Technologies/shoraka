import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  GetAdminUsersParams,
  UpdateAdminRoleInput,
  InviteAdminInput,
  InviteAdminResponse,
} from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useAdminUsers(params: GetAdminUsersParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "admin-users", params],
    queryFn: async () => {
      const response = await apiClient.getAdminUsers(params);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useUpdateAdminRole() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: UpdateAdminRoleInput }) => {
      const response = await apiClient.updateAdminRole(userId, data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate both queries to keep /users and /settings/roles in sync
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useDeactivateAdmin() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.deactivateAdmin(userId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate both queries to keep /users and /settings/roles in sync
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useReactivateAdmin() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.reactivateAdmin(userId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      // Invalidate both queries to keep /users and /settings/roles in sync
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useGenerateInvitationUrl() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InviteAdminInput): Promise<{ inviteUrl: string }> => {
      const response = await apiClient.generateInviteLink(data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingInvitations"] });
    },
  });
}

export function useInviteAdmin() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: InviteAdminInput): Promise<InviteAdminResponse> => {
      const response = await apiClient.inviteAdmin(data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["pendingInvitations"] });
    },
  });
}
