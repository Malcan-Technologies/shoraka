import {
  createApiClient,
  getReviewDetailRefreshPolicy,
  getReviewListRefreshPolicy,
  useAuthToken,
} from "@cashsouk/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApplicationStatus, isCapacityErrorCode, WithdrawReason } from "@cashsouk/types";
import type {
  Application,
  CreateApplicationInput,
  UpdateApplicationStepInput,
  UtilisationOfferConsentId,
} from "@cashsouk/types";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiMutationError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiMutationError";
  }
}

export function getApiMutationErrorCode(error: unknown): string | null {
  return error instanceof ApiMutationError ? error.code ?? null : null;
}

export function useApplication(id: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const refreshPolicy = getReviewDetailRefreshPolicy();

  return useQuery({
    queryKey: ["application", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.getApplication(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: !!id,
    ...refreshPolicy,
  });
}

export function useCreateApplication() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateApplicationInput) => {
      const response = await apiClient.createApplication(data);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to create application", {
        description: error.message,
      });
    },
  });
}

export function useUpdateApplicationStep() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stepData }: { id: string; stepData: UpdateApplicationStepInput }) => {
      const response = await apiClient.updateApplicationStep(id, stepData);
      if (!response.success) {
        throw new ApiMutationError(response.error.message, response.error.code);
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["application", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
    },
    onError: (error: Error) => {
      // Caller maps structured financing-structure codes to specific copy.
      if (
        error instanceof ApiMutationError &&
        (error.code === "STRUCTURE_CHANGE_BLOCKED" || error.code === "MAX_INVOICES_REACHED")
      ) {
        return;
      }
      toast.error("Failed to save progress", {
        description: error.message,
      });
    },
  });
}

export function useUpdateApplicationStatus() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: Extract<ApplicationStatus, ApplicationStatus.DRAFT | ApplicationStatus.SUBMITTED | ApplicationStatus.RESUBMITTED>;
    }) => {
      const response = await apiClient.updateApplicationStatus(id, status);
      if (!response.success) {
        throw new ApiMutationError(response.error.message, response.error.code);
      }
      return response.data;
    },
    onSuccess: (application, variables) => {
      const organizationId = application?.issuer_organization_id as string | null | undefined;
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["issuer-org-latest-financial-statements", organizationId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["issuer-org-latest-financial-statements"] });
      }

      queryClient.invalidateQueries({ queryKey: ["application", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
    },
    onError: (error: Error) => {
      if (isCapacityErrorCode(getApiMutationErrorCode(error))) return;
      toast.error("Failed to update application status", {
        description: error.message,
      });
    },
  });
}

export function useResubmitApplication() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getAccessToken();
      const response = await fetch(`${API_URL}/v1/applications/${id}/resubmit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const json = await response.json();
      if (!json.success) {
        throw new ApiMutationError(
          json.error?.message ?? "Failed to resubmit",
          json.error?.code
        );
      }
      return json.data;
    },
    onSuccess: (application, id) => {
      const organizationId = application?.issuer_organization_id as string | null | undefined;
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["issuer-org-latest-financial-statements", organizationId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["issuer-org-latest-financial-statements"] });
      }

      queryClient.invalidateQueries({ queryKey: ["application", id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
    },
    onError: (error: Error) => {
      if (isCapacityErrorCode(getApiMutationErrorCode(error))) return;
      toast.error("Failed to resubmit", {
        description: error.message,
      });
    },
  });
}

export function useArchiveApplication() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.archiveApplication(id);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to archive application", {
        description: error.message,
      });
    },
  });
}

export function useDeleteDraftApplication() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.deleteDraftApplication(id);
      if (!response.success) {
        throw new Error(response.error.message ?? "Failed to delete draft");
      }
      return { id };
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["application", id] });
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to delete draft", {
        description: error.message,
      });
    },
  });
}

export function useCancelApplication() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.cancelApplication(id);
      if (!response.success) {
        throw new Error(response.error.message ?? "Failed to cancel");
      }
      return response.data;
    },
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["application", id] });
      const organizationId = (data as Application | undefined)?.issuer_organization_id;
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", organizationId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["applications"] });
      }
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to withdraw application", {
        description: error.message,
      });
    },
  });
}

export function useWithdrawInvoice() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      applicationId,
      organizationId,
      reason,
    }: {
      invoiceId: string;
      applicationId: string;
      organizationId?: string;
      reason?: WithdrawReason;
    }) => {
      const response = await apiClient.withdrawInvoice(invoiceId, reason);
      if (!response.success) {
        throw new Error(response.error.message ?? "Failed to withdraw invoice");
      }
      return { data: response.data, applicationId, organizationId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["application", variables.applicationId] });
      if (variables.organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", variables.organizationId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["applications"] });
      }
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to withdraw invoice", {
        description: error.message,
      });
    },
  });
}

export function useWithdrawContract() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contractId,
      applicationId,
      organizationId,
    }: {
      contractId: string;
      applicationId: string;
      organizationId?: string;
    }) => {
      const response = await apiClient.withdrawContract(contractId);
      if (!response.success) {
        throw new Error(response.error.message ?? "Failed to withdraw facility");
      }
      return { data: response.data, applicationId, organizationId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["application", variables.applicationId] });
      if (variables.organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", variables.organizationId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["applications"] });
      }
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard-contract"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to withdraw facility", {
        description: error.message,
      });
    },
  });
}

export function useOrganizationApplications(organizationId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const refreshPolicy = getReviewListRefreshPolicy();

  return useQuery({
    queryKey: ["applications", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const response = await apiClient.get(`/v1/applications?organizationId=${encodeURIComponent(organizationId)}`);
      if (!response.success) {
        throw new Error(response.error.message || "Failed to list applications");
      }
      return response.data as Application[];
    },
    enabled: !!organizationId,
    ...refreshPolicy,
  });
}

export function useIssuerOrganizationLatestFinancialStatements(organizationId?: string, enabled: boolean = true) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  type LatestOrgFinancialStatementsResponse =
    | {
        financial_statements: unknown;
        source_application_id: string | null;
        source_application_revision_id: string | null;
        updated_at: string;
      }
    | null;

  return useQuery({
    queryKey: ["issuer-org-latest-financial-statements", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const response = await apiClient.get<LatestOrgFinancialStatementsResponse>(
        `/v1/organizations/issuer/${organizationId}/financial-statements/latest`
      );
      if (!response.success) {
        throw new Error(response.error.message || "Failed to fetch organization latest financial statements");
      }
      return response.data;
    },
    enabled: !!organizationId && enabled,
  });
}

function getOfferError(
  res: { success: true } | { success: false; error: { code?: string; message?: string } }
): string {
  if (res.success) return "";
  return res.error?.message ?? "Offer operation failed";
}

function throwOfferError(
  res: { success: true } | { success: false; error: { code?: string; message?: string } }
): never {
  const error = new Error(getOfferError(res)) as Error & { code?: string };
  if (!res.success && typeof res.error?.code === "string") {
    error.code = res.error.code;
  }
  throw error;
}

export function useRejectContractOffer() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      reason,
    }: {
      applicationId: string;
      reason?: string;
    }) => {
      const res = await apiClient.rejectContractOffer(applicationId, {
        ...(reason != null && reason.trim() !== "" ? { reason: reason.trim() } : {}),
      });
      if (!res.success) throw new Error(getOfferError(res));
      return res.data;
    },
    onSuccess: async (data, variables) => {
      const applicationId = variables.applicationId;
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      const organizationId = data?.issuer_organization_id;
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", organizationId] });
      }
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      await queryClient.refetchQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard-contract"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to decline offer", { description: error.message });
    },
  });
}

export function useAcceptInvoiceOffer() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      invoiceId,
      challenge_id,
      otp_code,
      consent_ids,
    }: {
      applicationId: string;
      invoiceId: string;
      challenge_id: string;
      otp_code: string;
      consent_ids: UtilisationOfferConsentId[];
    }) => {
      const res = await apiClient.acceptInvoiceOffer(applicationId, invoiceId, {
        challenge_id,
        otp_code,
        consent_ids,
      });
      if (!res.success) throwOfferError(res);
      return res.data;
    },
    onSuccess: async (data, { applicationId }) => {
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      const organizationId = data?.issuer_organization_id;
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", organizationId] });
      }
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      await queryClient.refetchQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard-contract"] });
    },
  });
}

export function useRejectInvoiceOffer() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      invoiceId,
      reason,
    }: {
      applicationId: string;
      invoiceId: string;
      reason?: string;
    }) => {
      const res = await apiClient.rejectInvoiceOffer(applicationId, invoiceId, {
        ...(reason != null && reason.trim() !== "" ? { reason: reason.trim() } : {}),
      });
      if (!res.success) throw new Error(getOfferError(res));
      return res.data;
    },
    onSuccess: async (data, variables) => {
      const applicationId = variables.applicationId;
      queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
      const organizationId = data?.issuer_organization_id;
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ["applications", organizationId] });
      }
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      await queryClient.refetchQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["issuer-dashboard-contract"] });
    },
    onError: (error: Error) => {
      toast.error("Failed to decline offer", { description: error.message });
    },
  });
}
