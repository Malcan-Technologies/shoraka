import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface CreateDraftApplicationInput {
  productId?: string;
  issuerOrganizationId?: string;
}

export interface UpdateApplicationInput {
  productId?: string;
  data?: {
    financingTerms?: unknown;
    invoiceDetails?: unknown;
    companyInfo?: unknown;
    supportingDocuments?: unknown;
    declaration?: unknown;
  };
}

export interface Application {
  id: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  lastCompletedStep: number;
  financingType: { productId?: string } | null;
  financingTerms: unknown | null;
  invoiceDetails: unknown | null;
  companyInfo: unknown | null;
  supportingDocuments: unknown | null;
  declaration: unknown | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new draft application
 */
export function useCreateDraftApplication() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDraftApplicationInput) => {
      const response = await apiClient.post("/v1/applications", input);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data as Application;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["application", data.id] });
    },
  });
}

/**
 * Get application by ID
 */
export function useApplication(id: string | null) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["application", id],
    queryFn: async () => {
      if (!id) return null;
      const response = await apiClient.get(`/v1/applications/${id}`);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data as Application;
    },
    enabled: !!id,
  });
}

/**
 * Validate step access
 */
export function useValidateStep(applicationId: string | null, step: number) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["application", applicationId, "validate-step", step],
    queryFn: async () => {
      if (!applicationId) return null;
      const response = await apiClient.get(
        `/v1/applications/${applicationId}/validate-step?step=${step}`
      );
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data as { allowed: boolean; lastAllowedStep: number };
    },
    enabled: !!applicationId && step > 0,
  });
}

/**
 * Update application
 */
export function useUpdateApplication() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateApplicationInput;
    }) => {
      const response = await apiClient.patch(`/v1/applications/${id}`, input);
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data as Application;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["application", variables.id] });
    },
  });
}

/**
 * Submit application
 */
export function useSubmitApplication() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.post(`/v1/applications/${id}/submit`, {});
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data as Application;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["application", id] });
    },
  });
}
