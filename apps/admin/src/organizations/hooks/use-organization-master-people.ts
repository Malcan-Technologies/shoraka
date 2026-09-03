import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { PortalType } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useOrganizationMasterPeople(portal: PortalType, organizationId: string) {
  const { getAccessToken } = useAuthToken();
  const api = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["admin", "organization-detail", portal, organizationId],
    });

  const resolve = useMutation({
    mutationFn: async (input: { partyId: string; action: "KEEP" | "USE_EXTERNAL"; field: string }) => {
      const res = await api.resolvePartyMismatch(portal, organizationId, input.partyId, {
        action: input.action,
        field: input.field,
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("CashSouk master value updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const adopt = useMutation({
    mutationFn: async (partyId: string) => {
      const res = await api.adoptObservedParty(portal, organizationId, partyId);
      if (!res.success) throw new Error(res.error.message);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Person added to the CashSouk master list");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const inactivate = useMutation({
    mutationFn: async (partyId: string) => {
      const res = await api.inactivateMasterParty(portal, organizationId, partyId);
      if (!res.success) throw new Error(res.error.message);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Person marked inactive on the master list");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createParty = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.createAdminPartyProfile(portal, organizationId, data);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Person added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const patchParty = useMutation({
    mutationFn: async (input: { partyId: string; data: Record<string, unknown> }) => {
      const res = await api.patchAdminPartyProfile(portal, organizationId, input.partyId, input.data);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Person updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { resolve, adopt, inactivate, createParty, patchParty };
}
