import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useApproveReviewSection() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({ applicationId, section }: { applicationId: string; section: string }) => {
      const response = await apiClient.approveReviewSection(applicationId, section);
      if (!response.success) {
        throw new Error((response as any).error?.message ?? "Failed to approve section");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
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
      note,
    }: {
      applicationId: string;
      section: string;
      note: string;
    }) => {
      const response = await apiClient.rejectReviewSection(applicationId, section, note);
      if (!response.success) {
        throw new Error((response as any).error?.message ?? "Failed to reject section");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
    },
  });
}

export function useRequestAmendmentReviewSection() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      section,
      note,
    }: {
      applicationId: string;
      section: string;
      note: string;
    }) => {
      const response = await apiClient.requestAmendmentReviewSection(applicationId, section, note);
      if (!response.success) {
        throw new Error((response as any).error?.message ?? "Failed to request amendment");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
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
    }: {
      applicationId: string;
      itemType: "INVOICE" | "DOCUMENT";
      itemId: string;
    }) => {
      const response = await apiClient.approveReviewItem(applicationId, itemType, itemId);
      if (!response.success) {
        throw new Error((response as any).error?.message ?? "Failed to approve item");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
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
      note,
    }: {
      applicationId: string;
      itemType: "INVOICE" | "DOCUMENT";
      itemId: string;
      note: string;
    }) => {
      const response = await apiClient.rejectReviewItem(applicationId, itemType, itemId, note);
      if (!response.success) {
        throw new Error((response as any).error?.message ?? "Failed to reject item");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
    },
  });
}

export function useRequestAmendmentReviewItem() {
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useMutation({
    mutationFn: async ({
      applicationId,
      itemType,
      itemId,
      note,
    }: {
      applicationId: string;
      itemType: "INVOICE" | "DOCUMENT";
      itemId: string;
      note: string;
    }) => {
      const response = await apiClient.requestAmendmentReviewItem(
        applicationId,
        itemType,
        itemId,
        note
      );
      if (!response.success) {
        throw new Error((response as any).error?.message ?? "Failed to request amendment");
      }
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin", "applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "applications", variables.applicationId] });
    },
  });
}
