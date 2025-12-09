import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  GetUsersParams,
  UpdateUserRolesInput,
  UpdateUserOnboardingInput,
  UpdateUserProfileInput,
} from "@cashsouk/types";
import { toast } from "sonner";

export function useUsers(params: GetUsersParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);
  
  return useQuery({
    queryKey: ["admin", "users", params],
    queryFn: async () => {
      const response = await apiClient.getUsers(params);
      if (!response.success) {
        // Handle authentication errors
        if (response.error.code === "UNAUTHORIZED" || response.error.code === "FORBIDDEN") {
          // Only redirect in production or if auth is enabled
          // In development with DISABLE_AUTH, just show the error
          if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
            const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || "http://localhost:3000";
            window.location.href = landingUrl;
          }
        }
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error instanceof Error && (error.message.includes("UNAUTHORIZED") || error.message.includes("FORBIDDEN"))) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useUser(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);
  
  return useQuery({
    queryKey: ["admin", "users", id],
    queryFn: async () => {
      const response = await apiClient.getUser(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.user;
    },
    enabled: !!id,
  });
}

export function useUpdateUserRoles() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);

  return useMutation({
    mutationFn: async ({ id, roles }: { id: string; roles: UpdateUserRolesInput }) => {
      const response = await apiClient.updateUserRoles(id, roles);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User roles updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update user roles", {
        description: error.message,
      });
    },
  });
}

export function useUpdateUserKyc() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);

  return useMutation({
    mutationFn: async ({ id, kycVerified }: { id: string; kycVerified: boolean }) => {
      const response = await apiClient.updateUserKyc(id, { kycVerified });
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("KYC status updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update KYC status", {
        description: error.message,
      });
    },
  });
}

export function useUpdateUserOnboarding() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);

  return useMutation({
    mutationFn: async ({ id, onboarding }: { id: string; onboarding: UpdateUserOnboardingInput }) => {
      const response = await apiClient.updateUserOnboarding(id, onboarding);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("Onboarding status updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update onboarding status", {
        description: error.message,
      });
    },
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(undefined, getAccessToken);

  return useMutation({
    mutationFn: async ({ id, profile }: { id: string; profile: UpdateUserProfileInput }) => {
      const response = await apiClient.updateUserProfile(id, profile);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User profile updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update user profile", {
        description: error.message,
      });
    },
  });
}

