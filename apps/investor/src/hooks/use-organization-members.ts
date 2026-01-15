import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useOrganizationMembers(organizationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["organization-members", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const result = await apiClient.get<{
        members: Array<{
          id: string;
          email: string;
          firstName: string;
          lastName: string;
          role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER";
        }>;
      }>(`/v1/organizations/investor/${organizationId}`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data.members;
    },
    enabled: !!organizationId,
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!organizationId) throw new Error("No organization selected");
      const result = await apiClient.delete(
        `/v1/organizations/investor/${organizationId}/members/${userId}`
      );
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      toast.success("Member removed successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to remove member", { description: error.message });
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "ORGANIZATION_ADMIN" | "ORGANIZATION_MEMBER" }) => {
      if (!organizationId) throw new Error("No organization selected");
      const result = await apiClient.patch(
        `/v1/organizations/investor/${organizationId}/members/${userId}/role`,
        { role }
      );
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization-members", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      toast.success("Member role updated successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to update member role", { description: error.message });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No organization selected");
      const result = await apiClient.post(`/v1/organizations/investor/${organizationId}/leave`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      toast.success("Left organization successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to leave organization", { description: error.message });
    },
  });

  return {
    members: data || [],
    isLoading,
    error,
    removeMember: removeMemberMutation.mutate,
    changeRole: changeRoleMutation.mutate,
    leave: leaveMutation.mutate,
    isRemoving: removeMemberMutation.isPending,
    isChangingRole: changeRoleMutation.isPending,
    isLeaving: leaveMutation.isPending,
  };
}
