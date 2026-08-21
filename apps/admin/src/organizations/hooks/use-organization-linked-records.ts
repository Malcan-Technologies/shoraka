import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type {
  OrganizationLinkedRecordsResponse,
  OrganizationLinkedRecordType,
  PortalType,
} from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useOrganizationLinkedRecords({
  portal,
  id,
  type,
  page,
  pageSize = 20,
  enabled = true,
}: {
  portal: PortalType;
  id: string;
  type: OrganizationLinkedRecordType;
  page: number;
  pageSize?: number;
  enabled?: boolean;
}) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery<OrganizationLinkedRecordsResponse>({
    queryKey: ["admin", "organization-linked-records", portal, id, type, page, pageSize],
    queryFn: async () => {
      const response = await apiClient.getOrganizationLinkedRecords(portal, id, {
        page,
        pageSize,
        type,
      });
      if (!response.success) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    enabled: Boolean(portal) && Boolean(id) && enabled,
  });
}
