/**
 * Admin data hooks for multi-party signing envelopes: list per application plus
 * send / void / remind mutations. Mirrors the review-actions hook pattern.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, getLiveSigningEnvelopeRefetchInterval, useAuthToken } from "@cashsouk/config";
import type { SigningEnvelopeDto } from "@cashsouk/types";
import { applicationsKeys } from "@/applications/query-keys";
import { applicationLogsKeys } from "./use-application-logs";
import {
  invalidateAdminApplicationDetailQueries,
  invalidateAdminApplicationNavQueries,
} from "@/lib/admin-application-nav-cache";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const signingKeys = {
  all: ["admin", "signing"] as const,
  byApplication: (applicationId: string) =>
    [...signingKeys.all, "application", applicationId] as const,
};

function invalidateAfterSigningMutation(
  queryClient: ReturnType<typeof useQueryClient>,
  applicationId: string
) {
  invalidateAdminApplicationNavQueries(queryClient);
  invalidateAdminApplicationDetailQueries(queryClient, applicationId, {
    includeActionCount: true,
  });
  void queryClient.invalidateQueries({ queryKey: applicationLogsKeys.list(applicationId) });
  void queryClient.invalidateQueries({ queryKey: signingKeys.byApplication(applicationId) });
  void queryClient.invalidateQueries({ queryKey: applicationsKeys.detail(applicationId) });
}

export function useAdminSigningEnvelopes(applicationId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: signingKeys.byApplication(applicationId),
    queryFn: async (): Promise<SigningEnvelopeDto[]> => {
      const response = await apiClient.getAdminSigningEnvelopes(applicationId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    enabled: !!applicationId,
    refetchInterval: (query) => getLiveSigningEnvelopeRefetchInterval(query.state.data),
    refetchIntervalInBackground: false,
  });
}

export function useSendAdminSigningPackage(applicationId: string) {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (vars?: {
      contractId?: string | null;
      invoiceId?: string | null;
    }): Promise<SigningEnvelopeDto> => {
      const response = await apiClient.sendAdminSigningPackage(applicationId, vars);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: async () => {
      invalidateAfterSigningMutation(queryClient, applicationId);
      await queryClient.refetchQueries({
        queryKey: applicationsKeys.detail(applicationId),
      });
    },
  });
}

export function useVoidSigningEnvelope(applicationId: string) {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (vars: { envelopeId: string; reason?: string }): Promise<SigningEnvelopeDto> => {
      const response = await apiClient.voidSigningEnvelope(vars.envelopeId, vars.reason);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      invalidateAfterSigningMutation(queryClient, applicationId);
    },
  });
}

export function useRemindSigningRecipient(applicationId: string) {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (vars: { envelopeId: string; recipientId: string }): Promise<void> => {
      const response = await apiClient.remindSigningRecipient(vars.envelopeId, vars.recipientId);
      if (!response.success) throw new Error(response.error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: signingKeys.byApplication(applicationId) });
    },
  });
}
