"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { FacilityFeePaymentResponse, GatewayPaymentStatus } from "@cashsouk/types";
import {
  FACILITY_FEE_HELD_ERROR_CODE,
  facilityFeePollIntervalMs,
  isTerminalFacilityFeeStatus,
  mapFacilityFeeOwnershipError,
  readErrorCode,
} from "@/lib/facility-fee-payment-ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const facilityFeePaymentKeys = {
  all: ["facility-fee-payment"] as const,
  detail: (contractId?: string, paymentId?: string) =>
    [...facilityFeePaymentKeys.all, contractId, paymentId] as const,
};

function useFacilityFeePaymentApiClient() {
  const { getAccessToken } = useAuthToken();
  return createApiClient(API_URL, getAccessToken);
}

function throwFacilityFeeApiError(message: string, code?: string): never {
  const error = new Error(mapFacilityFeeOwnershipError({ message, code })) as Error & {
    code?: string;
  };
  error.code = code;
  throw error;
}

export function useCreateFacilityFeePaymentMutation() {
  const apiClient = useFacilityFeePaymentApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contractId: string) => {
      const response = await apiClient.createFacilityFeePayment(contractId);
      if (!response.success) {
        throwFacilityFeeApiError(response.error.message, response.error.code);
      }
      return response.data;
    },
    onSuccess: (data, contractId) => {
      queryClient.setQueryData(facilityFeePaymentKeys.detail(contractId, data.id), data);
    },
  });
}

export function useFacilityFeePaymentQuery(
  contractId?: string,
  paymentId?: string,
  options?: { pollUntilTerminal?: boolean }
) {
  const apiClient = useFacilityFeePaymentApiClient();

  return useQuery({
    queryKey: facilityFeePaymentKeys.detail(contractId, paymentId),
    enabled: Boolean(contractId && paymentId),
    queryFn: async () => {
      if (!contractId || !paymentId) {
        throw new Error("Facility and payment ID are required");
      }
      const response = await apiClient.getFacilityFeePayment(contractId, paymentId);
      if (!response.success) {
        throwFacilityFeeApiError(response.error.message, response.error.code);
      }
      return response.data;
    },
    refetchInterval: (query) =>
      facilityFeePollIntervalMs(query.state.data?.status, Boolean(options?.pollUntilTerminal)),
    staleTime: 0,
    refetchOnMount: "always",
    retry: (failureCount, error) => {
      const code = readErrorCode(error);
      if (
        code === "CONTRACT_FORBIDDEN" ||
        code === "FACILITY_FEE_NOT_FOUND" ||
        code === FACILITY_FEE_HELD_ERROR_CODE
      ) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function isFacilityFeeHeldError(error: unknown): boolean {
  return readErrorCode(error) === FACILITY_FEE_HELD_ERROR_CODE;
}

export { isTerminalFacilityFeeStatus };
export type { FacilityFeePaymentResponse, GatewayPaymentStatus };
