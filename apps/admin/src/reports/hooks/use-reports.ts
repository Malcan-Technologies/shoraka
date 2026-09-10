"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { ReportKey, ReportQuery } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function useReportsApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

export const reportsKeys = {
  all: ["admin-reports"] as const,
  catalog: () => [...reportsKeys.all, "catalog"] as const,
  report: (key: ReportKey, params: ReportQuery) => [...reportsKeys.all, key, params] as const,
};

export function useAdminReportCatalog() {
  const apiClient = useReportsApiClient();
  return useQuery({
    queryKey: reportsKeys.catalog(),
    queryFn: async () => {
      const response = await apiClient.getAdminReportCatalog();
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });
}

export function useAdminReport(
  key: ReportKey,
  params: ReportQuery,
  enabled = true,
  options?: { refetchInterval?: number; staleTime?: number }
) {
  const apiClient = useReportsApiClient();
  return useQuery({
    queryKey: reportsKeys.report(key, params),
    queryFn: async () => {
      const response = await apiClient.getAdminReport(key, params);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    enabled,
    refetchInterval: options?.refetchInterval,
    staleTime: options?.staleTime,
  });
}

export function useDownloadAdminReport() {
  const apiClient = useReportsApiClient();
  return useMutation({
    mutationFn: async (input: { key: ReportKey; params: ReportQuery; format: "csv" | "xlsx" }) => {
      const blob = await apiClient.downloadAdminReport(input.key, {
        ...input.params,
        format: input.format,
      });
      return blob;
    },
  });
}
