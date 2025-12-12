import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import type {
  GetUsersParams,
  UpdateUserRolesInput,
  UpdateUserKycInput,
  UpdateUserOnboardingInput,
  UpdateUserProfileInput,
} from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useUsers(params: GetUsersParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "users", params],
    queryFn: async () => {
      const response = await apiClient.getUsers(params);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useUpdateUserRoles() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: UpdateUserRolesInput }) => {
      const response = await apiClient.updateUserRoles(userId, data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "admin-users"] });
      toast.success("Roles updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update roles", {
        description: error.message,
      });
    },
  });
}

export function useUpdateUserKyc() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: UpdateUserKycInput }) => {
      const response = await apiClient.updateUserKyc(userId, data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useUpdateUserOnboarding() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: UpdateUserOnboardingInput }) => {
      const response = await apiClient.updateUserOnboarding(userId, data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useUpdateUserProfile() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: UpdateUserProfileInput }) => {
      const response = await apiClient.updateUserProfile(userId, data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useUpdateUserId() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, newUserId }: { userId: string; newUserId: string }) => {
      const response = await apiClient.updateUserId(userId, newUserId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

