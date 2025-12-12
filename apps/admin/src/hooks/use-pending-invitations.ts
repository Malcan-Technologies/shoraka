"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import type { GetPendingInvitationsParams } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function usePendingInvitations(params: GetPendingInvitationsParams) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["pendingInvitations", params],
    queryFn: async () => {
      const response = await apiClient.getPendingInvitations(params);
      if ("error" in response) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
  });
}

export function useResendInvitation() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiClient.resendInvitation(invitationId);
      if ("error" in response) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: (data) => {
      if (data.emailSent) {
        toast.success("Invitation email resent successfully");
      } else {
        toast.error(`Failed to resend invitation: ${data.emailError || "Unknown error"}`);
      }
      queryClient.invalidateQueries({ queryKey: ["pendingInvitations"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resend invitation");
    },
  });
}

export function useRevokeInvitation() {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiClient.revokeInvitation(invitationId);
      if ("error" in response) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onSuccess: () => {
      toast.success("Invitation revoked successfully");
      queryClient.invalidateQueries({ queryKey: ["pendingInvitations"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to revoke invitation");
    },
  });
}
