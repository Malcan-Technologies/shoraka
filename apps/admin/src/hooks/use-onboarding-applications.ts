import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetOnboardingApplicationsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useOnboardingApplications(params: GetOnboardingApplicationsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "onboarding-applications", params],
    queryFn: async () => {
      const response = await apiClient.getOnboardingApplications(params);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useInvalidateOnboardingApplications() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "onboarding-applications"] });
  };
}

export function useOnboardingApplication(onboardingId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "onboarding-application", onboardingId],
    queryFn: async () => {
      const response = await apiClient.getOnboardingApplication(onboardingId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.application;
    },
    enabled: !!onboardingId,
    staleTime: 0,
    refetchOnMount: true,
  });
}

export function useRefreshOnboardingApplication() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (onboardingId: string) => {
      const response = await apiClient.getOnboardingApplication(onboardingId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data.application;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "onboarding-applications"] });
    },
  });
}

export function useRestartOnboarding() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (onboardingId: string) => {
      const response = await apiClient.restartOnboarding(onboardingId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "onboarding-applications"] });
    },
  });
}

export function useCompleteFinalApproval() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (onboardingId: string) => {
      const response = await apiClient.completeFinalApproval(onboardingId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "onboarding-applications"] });
    },
  });
}

export function useApproveSsmVerification() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (onboardingId: string) => {
      const response = await apiClient.approveSsmVerification(onboardingId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "onboarding-applications"] });
    },
  });
}

