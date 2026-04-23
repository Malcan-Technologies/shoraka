import {
  useQuery,
  useQueryClient,
  useMutation,
  type QueryClient,
} from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { GetOnboardingApplicationsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function invalidateOnboardingCaches(queryClient: QueryClient, onboardingId: string) {
  void queryClient.invalidateQueries({ queryKey: ["admin", "onboarding-applications"] });
  void queryClient.invalidateQueries({
    queryKey: ["admin", "onboarding-application", onboardingId],
  });
}

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
    refetchOnWindowFocus: true,
  });
}

export function useInvalidateOnboardingApplications() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "onboarding-applications"] });
  };
}

export function useOnboardingApplication(
  onboardingId: string,
  options?: { enabled?: boolean }
) {
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
    enabled: Boolean(onboardingId) && (options?.enabled ?? true),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
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
    onSuccess: (_data, onboardingId) => {
      invalidateOnboardingCaches(queryClient, onboardingId);
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
    onSuccess: (_data, onboardingId) => {
      invalidateOnboardingCaches(queryClient, onboardingId);
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
    onSuccess: (_data, onboardingId) => {
      invalidateOnboardingCaches(queryClient, onboardingId);
    },
  });
}

export function useApproveAmlScreening() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (onboardingId: string) => {
      const response = await apiClient.approveAmlScreening(onboardingId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (_data, onboardingId) => {
      invalidateOnboardingCaches(queryClient, onboardingId);
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
    onSuccess: (_data, onboardingId) => {
      invalidateOnboardingCaches(queryClient, onboardingId);
    },
  });
}

export function useRefreshCorporateStatus() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (onboardingId: string) => {
      const response = await apiClient.refreshCorporateStatus(onboardingId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (_data, onboardingId) => {
      invalidateOnboardingCaches(queryClient, onboardingId);
    },
  });
}

export function useRefreshCorporateAmlStatus() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (onboardingId: string) => {
      const response = await apiClient.refreshCorporateAmlStatus(onboardingId);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (_data, onboardingId) => {
      invalidateOnboardingCaches(queryClient, onboardingId);
    },
  });
}
