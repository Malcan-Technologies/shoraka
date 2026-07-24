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
    onSuccess: async () => {
      if (organizationId) {
        void queryClient.invalidateQueries({
          queryKey: ["admin", "organization-ctos-reports", "issuer", organizationId],
        });
        void queryClient.invalidateQueries({
          queryKey: ["admin", "organization-ctos-reports-inline", "issuer", organizationId],
        });
      }
      const refetches: Array<Promise<unknown>> = [];
      if (applicationDetailId) {
        refetches.push(
          queryClient.refetchQueries({
            queryKey: applicationsKeys.detail(applicationDetailId),
            type: "all",
          })
        );
      }
      if (organizationId) {
        refetches.push(
          queryClient.refetchQueries({
            queryKey: ["admin", "organization-detail", "issuer", organizationId],
            type: "all",
          })
        );
      }
      await Promise.all(refetches);
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
    onSuccess: async () => {
      const refetches: Array<Promise<unknown>> = [];
      if (applicationDetailId) {
        refetches.push(
          queryClient.refetchQueries({
            queryKey: applicationsKeys.detail(applicationDetailId),
            type: "all",
          })
        );
      }
      if (organizationId) {
        refetches.push(
          queryClient.refetchQueries({
            queryKey: ["admin", "organization-detail", "issuer", organizationId],
            type: "all",
          })
        );
      }
      await Promise.all(refetches);
    },
  });
}

/** Financial review tab — org-level CTOS fetch scoped to application financial permissions. */
export function useCreateApplicationCtosReport(applicationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.createAdminApplicationCtosReport(applicationId!);
      if (!response.success) {
        throw new Error(formatApiErrorMessage(response.error));
      }
      return response.data;
    },
    onSuccess: async () => {
      if (applicationId) {
        await queryClient.refetchQueries({
          queryKey: applicationsKeys.detail(applicationId),
          type: "all",
        });
      }
    },
  });
}

/** Business/guarantor review — subject CTOS fetch scoped to application guarantor permissions. */
export function useCreateApplicationCtosSubjectReport(applicationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: {
      subjectRef: string;
      subjectKind: "INDIVIDUAL" | "CORPORATE";
      enquiryOverride?: { displayName: string; idNumber: string };
    }) => {
      const response = await apiClient.createAdminApplicationCtosSubjectReport(applicationId!, body);
      if (!response.success) {
        throw new Error(formatApiErrorMessage(response.error));
      }
      return response.data;
    },
    onSuccess: async () => {
      if (applicationId) {
        await queryClient.refetchQueries({
          queryKey: applicationsKeys.detail(applicationId),
          type: "all",
        });
      }
    },
  });
}
