import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useOrganizationInvitations(organizationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["organization-invitations", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const result = await apiClient.get<{
        invitations: Array<{
          id: string;
          email: string;
          role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER";
          token: string;
          expiresAt: string;
          createdAt: string;
          invitedBy: {
            firstName: string;
            lastName: string;
            email: string;
          };
        }>;
      }>(`/v1/organizations/issuer/${organizationId}/invitations`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data.invitations;
    },
    enabled: !!organizationId,
  });

  const inviteMutation = useMutation({
    mutationFn: async ({
      email,
      role,
    }: {
      email?: string;
      role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER";
    }): Promise<{ success: boolean; invitationId: string; emailSent: boolean; invitationUrl?: string; emailError?: string }> => {
      if (!organizationId) throw new Error("No organization selected");
      const result = await apiClient.post<{ success: boolean; invitationId: string; emailSent: boolean; invitationUrl?: string; emailError?: string }>(
        `/v1/organizations/issuer/${organizationId}/members/invite`,
        { email, role }
      );
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: (data: { success: boolean; invitationId: string; emailSent: boolean; invitationUrl?: string; emailError?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["organization-invitations", organizationId] });
      if (data.emailSent) {
        toast.success("Invitation sent successfully");
      } else {
        toast.warning("Invitation created but email failed to send", {
          description: data.emailError || "You can copy the invitation link below",
        });
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to send invitation", { description: error.message });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!organizationId) throw new Error("No organization selected");
      const result = await apiClient.post(
        `/v1/organizations/issuer/${organizationId}/invitations/${invitationId}/resend`
      );
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["organization-invitations", organizationId] });
      if ((data as { success: boolean; emailSent: boolean }).emailSent) {
        toast.success("Invitation resent successfully");
      } else {
        toast.warning("Failed to resend email");
      }
    },
    onError: (error: Error) => {
      toast.error("Failed to resend invitation", { description: error.message });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!organizationId) throw new Error("No organization selected");
      const result = await apiClient.delete(
        `/v1/organizations/issuer/${organizationId}/invitations/${invitationId}`
      );
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-invitations", organizationId] });
      toast.success("Invitation revoked successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to revoke invitation", { description: error.message });
    },
  });

  const generateLinkMutation = useMutation({
    mutationFn: async ({
      email,
      role,
    }: {
      email?: string;
      role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER";
    }): Promise<{ invitationUrl: string }> => {
      if (!organizationId) throw new Error("No organization selected");
      const result = await apiClient.post<{ invitationUrl: string; token: string }>(
        `/v1/organizations/issuer/${organizationId}/members/generate-link`,
        { email, role }
      );
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return { invitationUrl: result.data.invitationUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-invitations", organizationId] });
    },
  });

  return {
    invitations: data || [],
    isLoading,
    error,
    invite: inviteMutation.mutateAsync,
    resend: resendMutation.mutate,
    revoke: revokeMutation.mutate,
    generateLink: generateLinkMutation.mutateAsync,
    isInviting: inviteMutation.isPending,
    isResending: resendMutation.isPending,
    isRevoking: revokeMutation.isPending,
    isGeneratingLink: generateLinkMutation.isPending,
  };
}
