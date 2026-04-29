"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { applicationsKeys } from "@/applications/query-keys";
import { formatApiErrorMessage } from "@/lib/format-api-error-message";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useCreateIssuerOrganizationCtosReport(
  organizationId: string | undefined,
  applicationDetailId?: string
) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.createAdminOrganizationCtosReport("issuer", organizationId!);
      if (!response.success) {
        throw new Error(formatApiErrorMessage(response.error));
      }
      return response.data;
    },
    onSuccess: () => {
      if (applicationDetailId) {
        void queryClient.invalidateQueries({ queryKey: applicationsKeys.detail(applicationDetailId) });
      }
    },
  });
}

export function useCreateIssuerOrganizationCtosSubjectReport(
  organizationId: string | undefined,
  applicationDetailId?: string
) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      subjectRef: string;
      subjectKind: "INDIVIDUAL" | "CORPORATE";
      /** Sends IC / SSM to CTOS when org JSON keys might not match `subjectRef` alone. */
      enquiryOverride?: { displayName: string; idNumber: string };
    }) => {
      const response = await apiClient.createAdminOrganizationCtosSubjectReport(
        "issuer",
        organizationId!,
        body
      );
      if (!response.success) {
        throw new Error(formatApiErrorMessage(response.error));
      }
      return response.data;
    },
    onSuccess: () => {
      if (applicationDetailId) {
        void queryClient.invalidateQueries({ queryKey: applicationsKeys.detail(applicationDetailId) });
      }
    },
  });
}
