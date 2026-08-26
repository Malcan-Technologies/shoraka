"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { ExcessLateChargePaymentResponse, GatewayPaymentStatus } from "@cashsouk/types";
import {
  EXCESS_LATE_CHARGE_HELD_ERROR_CODE,
  excessLateChargePollIntervalMs,
  isTerminalExcessLateChargeStatus,
  mapExcessLateChargeOwnershipError,
  readErrorCode,
} from "@/lib/excess-late-charge-payment-ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const excessLateChargePaymentKeys = {
  all: ["excess-late-charge-payment"] as const,
  detail: (noteId?: string, paymentId?: string) =>
    [...excessLateChargePaymentKeys.all, noteId, paymentId] as const,
};

function useExcessLateChargePaymentApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

function throwExcessLateChargeApiError(message: string, code?: string): never {
  const error = new Error(mapExcessLateChargeOwnershipError({ message, code })) as Error & {
    code?: string;
  };
  error.code = code;
  throw error;
}

export function useCreateExcessLateChargePaymentMutation() {
  const apiClient = useExcessLateChargePaymentApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (noteId: string) => {
      const response = await apiClient.createExcessLateChargePayment(noteId);
      if (!response.success) {
        throwExcessLateChargeApiError(response.error.message, response.error.code);
      }
      return response.data;
    },
    onSuccess: (data, noteId) => {
      queryClient.setQueryData(excessLateChargePaymentKeys.detail(noteId, data.id), data);
    },
  });
}

export function useExcessLateChargePaymentQuery(
  noteId?: string,
  paymentId?: string,
  options?: { pollUntilTerminal?: boolean }
) {
  const apiClient = useExcessLateChargePaymentApiClient();

  return useQuery({
    queryKey: excessLateChargePaymentKeys.detail(noteId, paymentId),
    enabled: Boolean(noteId && paymentId),
    queryFn: async () => {
      if (!noteId || !paymentId) {
        throw new Error("Note and payment ID are required");
      }
      const response = await apiClient.getExcessLateChargePayment(noteId, paymentId);
      if (!response.success) {
        throwExcessLateChargeApiError(response.error.message, response.error.code);
      }
      return response.data;
    },
    refetchInterval: (query) =>
      excessLateChargePollIntervalMs(query.state.data?.status, Boolean(options?.pollUntilTerminal)),
    staleTime: 0,
    refetchOnMount: "always",
    retry: (failureCount, error) => {
      const code = readErrorCode(error);
      if (
        code === "NOTE_FORBIDDEN" ||
        code === "EXCESS_LATE_CHARGE_NOT_FOUND" ||
        code === EXCESS_LATE_CHARGE_HELD_ERROR_CODE
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function isExcessLateChargeHeldError(error: unknown): boolean {
  return readErrorCode(error) === EXCESS_LATE_CHARGE_HELD_ERROR_CODE;
}

export { isTerminalExcessLateChargeStatus };
export type { ExcessLateChargePaymentResponse, GatewayPaymentStatus };
