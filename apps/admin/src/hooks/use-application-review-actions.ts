import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { ApiError, SoukscoreRiskRating } from "@cashsouk/types";
import { applicationLogsKeys } from "./use-application-logs";
import { applicationsKeys } from "@/applications/query-keys";
import { contractsKeys } from "@/contracts/query-keys";
import {
  invalidateAdminApplicationDetailQueries,
  invalidateAdminApplicationNavQueries,
} from "@/lib/admin-application-nav-cache";
import { mapAdminCapacityActionError } from "@/lib/facility-capacity-display";
import { signingKeys } from "./use-signing-envelopes";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const pendingAmendmentKeys = {
  all: ["admin", "pending-amendments"] as const,
  list: (applicationId: string) =>
    [...pendingAmendmentKeys.all, applicationId] as const,
};

function throwCapacityAwareActionError(response: ApiError, fallback: string): never {
  const mapped = mapAdminCapacityActionError(response, fallback);
  throw Object.assign(new Error(mapped.message), {
    code: response.error?.code,
  });
}

async function refetchApplicationAndFacility(
  queryClient: QueryClient,
  applicationId: string
): Promise<void> {
  await queryClient.refetchQueries({
    queryKey: applicationsKeys.detail(applicationId),
  });
  void queryClient.invalidateQueries({ queryKey: contractsKeys.all });
}

function invalidateReviewDetailExtras(
  queryClient: QueryClient,
  applicationId: string,
  options?: { includeActionCount?: boolean; includePendingAmendments?: boolean; includeLogs?: boolean }
): void {
  invalidateAdminApplicationDetailQueries(queryClient, applicationId, {
    includeActionCount: options?.includeActionCount,
  });
  if (options?.includePendingAmendments !== false) {
    void queryClient.invalidateQueries({
      queryKey: pendingAmendmentKeys.list(applicationId),
    });
  }
  if (options?.includeLogs !== false) {
    void queryClient.invalidateQueries({
      queryKey: applicationLogsKeys.list(applicationId),
    });
  }
}

export function useApproveReviewSection() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      section,
      remark,
    }: {
      applicationId: string;
      section: string;
      remark?: string;
    }) => {
      const response = await apiClient.approveReviewSection(applicationId, section, remark);
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to approve section");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      invalidateReviewDetailExtras(queryClient, variables.applicationId, {
        includeActionCount: true,
      });
    },
  });
}

export function useRejectReviewSection() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      section,
      remark,
    }: {
      applicationId: string;
      section: string;
      remark: string;
    }) => {
      const response = await apiClient.rejectReviewSection(applicationId, section, remark);
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to reject section");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      invalidateReviewDetailExtras(queryClient, variables.applicationId, {
        includeActionCount: true,
      });
    },
  });
}

export function useAddSectionComment() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      section,
      comment,
    }: {
      applicationId: string;
      section: string;
      comment: string;
    }) => {
      const response = await apiClient.addSectionComment(applicationId, section, comment);
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to add section comment");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      invalidateAdminApplicationDetailQueries(queryClient, variables.applicationId);
    },
  });
}

export function useStartApplicationGuarantorAml() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      clientGuarantorId,
    }: {
      applicationId: string;
      clientGuarantorId: string;
    }) => {
      const response = await apiClient.startAdminApplicationGuarantorAml(
        applicationId,
        clientGuarantorId
      );
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to start AML screening");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      invalidateAdminApplicationDetailQueries(queryClient, variables.applicationId);
    },
  });
}

export function useResetSectionReviewToPending() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      section,
    }: {
      applicationId: string;
      section: string;
    }) => {
      const response = await apiClient.resetSectionReviewToPending(applicationId, section);
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to reset section");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      invalidateReviewDetailExtras(queryClient, variables.applicationId, {
        includeActionCount: true,
      });
    },
  });
}

export function useApproveReviewItem() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      itemType,
      itemId,
      remark,
    }: {
      applicationId: string;
      itemType: "invoice" | "document";
      itemId: string;
      remark?: string;
    }) => {
      const response = await apiClient.approveReviewItem(
        applicationId,
        itemType,
        itemId,
        remark
      );
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to approve item");
      }
      return response.data;
    },
    onSuccess: async (_, variables) => {
      invalidateReviewDetailExtras(queryClient, variables.applicationId, {
        includeActionCount: true,
      });
      await queryClient.refetchQueries({
        queryKey: applicationsKeys.detail(variables.applicationId),
      });
    },
  });
}

export function useRejectReviewItem() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      itemType,
      itemId,
      remark,
    }: {
      applicationId: string;
      itemType: "invoice" | "document";
      itemId: string;
      remark: string;
    }) => {
      const response = await apiClient.rejectReviewItem(applicationId, itemType, itemId, remark);
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to reject item");
      }
      return response.data;
    },
    onSuccess: async (_, variables) => {
      invalidateReviewDetailExtras(queryClient, variables.applicationId, {
        includeActionCount: true,
      });
      await queryClient.refetchQueries({
        queryKey: applicationsKeys.detail(variables.applicationId),
      });
    },
  });
}

export function useResetItemReviewToPending() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      itemType,
      itemId,
    }: {
      applicationId: string;
      itemType: "invoice" | "document";
      itemId: string;
    }) => {
      const response = await apiClient.resetItemReviewToPending(
        applicationId,
        itemType,
        itemId
      );
      if (!response.success) {
        throw new Error((response as ApiError).error?.message ?? "Failed to reset item");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      invalidateReviewDetailExtras(queryClient, variables.applicationId, {
        includeActionCount: true,
      });
    },
  });
}

/** Immediate item amendment / acceptance "Request change" (not the underwriting draft queue). */
export function useRequestAmendmentReviewItem() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      itemType,
      itemId,
      remark,
    }: {
      applicationId: string;
      itemType: "invoice" | "document";
      itemId: string;
      remark: string;
    }) => {
      const response = await apiClient.requestAmendmentReviewItem(
        applicationId,
        itemType,
        itemId,
        remark
      );
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to request document change"
        );
      }
      return response.data;
    },
    onSuccess: async (_, variables) => {
      invalidateReviewDetailExtras(queryClient, variables.applicationId, {
        includeActionCount: true,
        includePendingAmendments: false,
      });
      await queryClient.refetchQueries({
        queryKey: applicationsKeys.detail(variables.applicationId),
      });
    },
  });
}

export function useSendContractOffer() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      offeredFacility,
      facilityFeeRatePercent,
    }: {
      applicationId: string;
      offeredFacility: number;
      facilityFeeRatePercent?: number | null;
    }) => {
      const response = await apiClient.sendContractOffer(
        applicationId,
        offeredFacility,
        facilityFeeRatePercent ?? null
      );
      if (!response.success) {
        throwCapacityAwareActionError(response as ApiError, "Failed to send facility offer");
      }
      return response.data;
    },
    onSuccess: async (_, variables) => {
      invalidateAdminApplicationNavQueries(queryClient);
      invalidateAdminApplicationDetailQueries(queryClient, variables.applicationId, {
        includeActionCount: true,
      });
      void queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
      void queryClient.invalidateQueries({
        queryKey: signingKeys.byApplication(variables.applicationId),
      });
      await refetchApplicationAndFacility(queryClient, variables.applicationId);
    },
    onError: async (error, variables) => {
      if (mapAdminCapacityActionError(error, "").shouldRefetch) {
        await refetchApplicationAndFacility(queryClient, variables.applicationId);
      }
    },
  });
}

export function useExtendContractSigningDeadline() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({ applicationId }: { applicationId: string }) => {
      const response = await apiClient.extendContractSigningDeadline(applicationId);
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to extend signing deadline"
        );
      }
      return response.data;
    },
    onSuccess: async (_, variables) => {
      invalidateAdminApplicationNavQueries(queryClient);
      invalidateAdminApplicationDetailQueries(queryClient, variables.applicationId, {
        includeActionCount: true,
      });
      void queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
      void queryClient.invalidateQueries({
        queryKey: signingKeys.byApplication(variables.applicationId),
      });
      await queryClient.refetchQueries({
        queryKey: applicationsKeys.detail(variables.applicationId),
      });
    },
  });
}

export function usePatchContractCustomerLargePrivate() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      isLargePrivateCompany,
    }: {
      applicationId: string;
      isLargePrivateCompany: boolean;
    }) => {
      const response = await apiClient.patchContractCustomerLargePrivate(applicationId, {
        is_large_private_company: isLargePrivateCompany,
      });
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to save customer type confirmation"
        );
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      invalidateReviewDetailExtras(queryClient, variables.applicationId, {
        includePendingAmendments: false,
      });
    },
  });
}

export function useSendInvoiceOffer() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      invoiceId,
      offeredAmount,
      offeredRatioPercent,
      offeredProfitRatePercent,
      platformFeeRatePercent,
      risk_rating,
    }: {
      applicationId: string;
      invoiceId: string;
      offeredAmount: number;
      offeredRatioPercent?: number | null;
      offeredProfitRatePercent?: number | null;
      platformFeeRatePercent?: number | null;
      risk_rating: SoukscoreRiskRating;
    }) => {
      const response = await apiClient.sendInvoiceOffer(applicationId, invoiceId, {
        offeredAmount,
        offeredRatioPercent,
        offeredProfitRatePercent,
        platformFeeRatePercent,
        risk_rating,
      });
      if (!response.success) {
        throwCapacityAwareActionError(response as ApiError, "Failed to send invoice offer");
      }
      return response.data;
    },
    onSuccess: async (_, variables) => {
      invalidateAdminApplicationNavQueries(queryClient);
      invalidateAdminApplicationDetailQueries(queryClient, variables.applicationId, {
        includeActionCount: true,
      });
      void queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
      void queryClient.invalidateQueries({
        queryKey: signingKeys.byApplication(variables.applicationId),
      });
      await refetchApplicationAndFacility(queryClient, variables.applicationId);
    },
    onError: async (error, variables) => {
      if (mapAdminCapacityActionError(error, "").shouldRefetch) {
        await refetchApplicationAndFacility(queryClient, variables.applicationId);
      }
    },
  });
}

export function useExtendInvoiceSigningDeadline() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      invoiceId,
    }: {
      applicationId: string;
      invoiceId: string;
    }) => {
      const response = await apiClient.extendInvoiceSigningDeadline(applicationId, invoiceId);
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to extend signing deadline"
        );
      }
      return response.data;
    },
    onSuccess: async (_, variables) => {
      invalidateAdminApplicationNavQueries(queryClient);
      invalidateAdminApplicationDetailQueries(queryClient, variables.applicationId, {
        includeActionCount: true,
      });
      void queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
      void queryClient.invalidateQueries({
        queryKey: signingKeys.byApplication(variables.applicationId),
      });
      await queryClient.refetchQueries({
        queryKey: applicationsKeys.detail(variables.applicationId),
      });
    },
  });
}

export function useAddPendingAmendment() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      scope,
      scopeKey,
      remark,
      itemType,
      itemId,
    }: {
      applicationId: string;
      scope: "section" | "item";
      scopeKey?: string;
      remark: string;
      itemType?: "invoice" | "document";
      itemId?: string;
    }) => {
      const response = await apiClient.addPendingAmendment(applicationId, {
        scope,
        scopeKey,
        remark,
        itemType,
        itemId,
      });
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to add pending amendment"
        );
      }
      return response.data;
    },
    onSuccess: async (_, variables) => {
      invalidateReviewDetailExtras(queryClient, variables.applicationId, {
        includePendingAmendments: false,
      });
      await queryClient.refetchQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
    },
  });
}

export function useListPendingAmendments(applicationId: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: pendingAmendmentKeys.list(applicationId),
    queryFn: async () => {
      const response = await apiClient.listPendingAmendments(applicationId);
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to list pending amendments"
        );
      }
      return response.data ?? [];
    },
    enabled: !!applicationId,
  });
}

export function useRemovePendingAmendment() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      scope,
      scopeKey,
    }: {
      applicationId: string;
      scope: string;
      scopeKey: string;
    }) => {
      const response = await apiClient.removePendingAmendment(
        applicationId,
        scope,
        scopeKey
      );
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to remove pending amendment"
        );
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
      invalidateAdminApplicationDetailQueries(queryClient, variables.applicationId);
    },
  });
}

export function useSubmitAmendmentRequest() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({ applicationId }: { applicationId: string }) => {
      const response = await apiClient.submitAmendmentRequest(applicationId);
      if (!response.success) {
        throw new Error(
          (response as ApiError).error?.message ?? "Failed to submit amendment request"
        );
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: pendingAmendmentKeys.list(variables.applicationId),
      });
      invalidateAdminApplicationNavQueries(queryClient);
      invalidateAdminApplicationDetailQueries(queryClient, variables.applicationId, {
        includeActionCount: true,
      });
      void queryClient.invalidateQueries({
        queryKey: applicationLogsKeys.list(variables.applicationId),
      });
    },
  });
}
