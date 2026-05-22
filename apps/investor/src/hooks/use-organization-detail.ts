"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createApiClient,
  useAuthToken,
  type BankAccountDetails,
} from "@cashsouk/config";

interface OrganizationDetail {
  bankAccountDetails: BankAccountDetails | null;
}

export function useOrganizationDetail(organizationId?: string, enabled = true) {
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(() => createApiClient(undefined, getAccessToken), [getAccessToken]);

  return useQuery({
    queryKey: ["organization-detail", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const result = await apiClient.get<OrganizationDetail>(
        `/v1/organizations/investor/${organizationId}`
      );
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    enabled: enabled && !!organizationId,
    staleTime: 1000 * 60 * 5,
  });
}
