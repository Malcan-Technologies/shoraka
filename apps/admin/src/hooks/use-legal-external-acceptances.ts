import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type LegalExternalAcceptanceListItem = {
  id: string;
  status: "OPENED" | "ACCEPTED";
  documentType: string | null;
  documentTitle: string;
  versionNumber: number | null;
  documentHash: string | null;
  partyName: string;
  partyEmail: string;
  partyIcMasked: string | null;
  partyRole: string | null;
  envelopeId: string | null;
  applicationId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  openedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
};

export function useLegalExternalAcceptances(page: number, search: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["admin", "legal-external-acceptances", page, search],
    queryFn: async () => {
      const query = new URLSearchParams();
      query.set("page", String(page));
      query.set("pageSize", "15");
      if (search.trim()) query.set("search", search.trim());
      const response = await apiClient.get<{
        acceptances: LegalExternalAcceptanceListItem[];
        pagination: { page: number; pageSize: number; totalCount: number; totalPages: number };
      }>(`/v1/admin/legal-external-acceptances?${query.toString()}`);
      if (!response.success) throw new Error("Failed to load external acceptances");
      return response.data;
    },
  });
}
