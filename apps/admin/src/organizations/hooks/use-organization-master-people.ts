import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { humanizeApiValidationMessage, profileValidationErrorFromApi, type PortalType } from "@cashsouk/types";

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
      if (!res.success) throw profileValidationErrorFromApi(res.error);
      return res.data;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Profile value updated");
    },
    onError: (err: Error) => toast.error(humanizeApiValidationMessage(err.message)),
  });

  const adopt = useMutation({
    mutationFn: async (partyId: string) => {
      const res = await api.adoptObservedParty(portal, organizationId, partyId);
      if (!res.success) throw profileValidationErrorFromApi(res.error);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Person added to the current profile");
    },
    onError: (err: Error) => toast.error(humanizeApiValidationMessage(err.message)),
  });

  const inactivate = useMutation({
    mutationFn: async (partyId: string) => {
      const res = await api.inactivateMasterParty(portal, organizationId, partyId);
      if (!res.success) throw profileValidationErrorFromApi(res.error);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Person marked inactive");
    },
    onError: (err: Error) => toast.error(humanizeApiValidationMessage(err.message)),
  });

  const resolveIdentityConflict = useMutation({
    mutationFn: async (input: { partyId: string; action: "KEEP_ONBOARDING" | "KEEP_CTOS" }) => {
      const res = await api.resolvePersonIdentityConflict(portal, organizationId, input.partyId, input.action);
      if (!res.success) throw profileValidationErrorFromApi(res.error);
    },
    onSuccess: async (_data, input) => {
      await invalidate();
      toast.success(
        input.action === "KEEP_ONBOARDING"
          ? "Onboarding Person kept. Identity saved without changing the Person key."
          : "Onboarding Person marked inactive. The CTOS Person remains available to Adopt."
      );
    },
    onError: (err: Error) => toast.error(humanizeApiValidationMessage(err.message)),
  });

  const createParty = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await api.createAdminPartyProfile(portal, organizationId, data);
      if (!res.success) throw profileValidationErrorFromApi(res.error);
      return res.data;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Person added");
    },
    onError: (err: Error) => toast.error(humanizeApiValidationMessage(err.message)),
  });

  const patchParty = useMutation({
    mutationFn: async (input: { partyId: string; data: Record<string, unknown> }) => {
      const res = await api.patchAdminPartyProfile(portal, organizationId, input.partyId, input.data);
      if (!res.success) throw profileValidationErrorFromApi(res.error);
      return res.data;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Person updated");
    },
    onError: (err: Error) => toast.error(humanizeApiValidationMessage(err.message)),
  });

  return { resolve, adopt, inactivate, resolveIdentityConflict, createParty, patchParty };
}
