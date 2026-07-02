/**
 * Admin data hooks for multi-party signing envelopes: list per application plus
 * build / send / void / remind mutations. Mirrors the review-actions hook pattern.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { RecipientBinding, SigningEnvelopeDto } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const signingKeys = {
  all: ["admin", "signing"] as const,
  byApplication: (applicationId: string) =>
    [...signingKeys.all, "application", applicationId] as const,
};

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
  });
}

export interface CreateSigningEnvelopeVars {
  applicationId: string;
  title: string;
  contractId?: string | null;
  invoiceId?: string | null;
  productVersion?: number | null;
  templateConfig: unknown;
  bindings: RecipientBinding[];
  expiresAt?: string | null;
}

export function useCreateSigningEnvelope() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (vars: CreateSigningEnvelopeVars): Promise<SigningEnvelopeDto> => {
      const response = await apiClient.createSigningEnvelope(vars);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: signingKeys.byApplication(vars.applicationId) });
    },
  });
}

export function useSendSigningEnvelope(applicationId: string) {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async (envelopeId: string): Promise<SigningEnvelopeDto> => {
      const response = await apiClient.sendSigningEnvelope(envelopeId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: signingKeys.byApplication(applicationId) });
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
      queryClient.invalidateQueries({ queryKey: signingKeys.byApplication(applicationId) });
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
