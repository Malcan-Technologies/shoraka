"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const ctosKeys = {
  all: ["admin", "ctos-reports"] as const,
  application: (applicationId: string) => [...ctosKeys.all, applicationId] as const,
};

const ctosSubjectKeys = {
  all: ["admin", "ctos-subject-reports"] as const,
  application: (applicationId: string) => [...ctosSubjectKeys.all, applicationId] as const,
};

export function useAdminApplicationCtosReports(applicationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ctosKeys.application(applicationId ?? ""),
    queryFn: async () => {
      const response = await apiClient.listAdminApplicationCtosReports(applicationId!);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: Boolean(applicationId),
  });
}

export function useCreateAdminApplicationCtosReport(applicationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.createAdminApplicationCtosReport(applicationId!);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      if (applicationId) {
        queryClient.invalidateQueries({ queryKey: ctosKeys.application(applicationId) });
      }
    },
  });
}

export function useAdminApplicationCtosSubjectReports(applicationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ctosSubjectKeys.application(applicationId ?? ""),
    queryFn: async () => {
      const response = await apiClient.listAdminApplicationCtosSubjectReports(applicationId!);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: Boolean(applicationId),
  });
}

export function useCreateAdminApplicationCtosSubjectReport(applicationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: { subjectRef: string; subjectKind: "INDIVIDUAL" | "CORPORATE" }) => {
      const response = await apiClient.createAdminApplicationCtosSubjectReport(applicationId!, body);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      if (applicationId) {
        queryClient.invalidateQueries({ queryKey: ctosSubjectKeys.application(applicationId) });
      }
    },
  });
}
