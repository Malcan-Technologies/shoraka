import { useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface DirectorKycEntry {
  name: string;
  email: string;
  role: string;
  kycStatus: string;
  kycId?: string;
  lastUpdated: string;
  eodRequestId?: string;
  shareholderEodRequestId?: string;
}

export interface DirectorKycStatus {
  directors: DirectorKycEntry[];
  lastSyncedAt: string;
  corpIndvDirectorCount: number;
  corpIndvShareholderCount: number;
  corpBizShareholderCount: number;
}

export interface DirectorDisplay {
  name: string;
  ownershipLabel: string;
  kycVerified: boolean;
}

export interface ShareholderDisplay {
  name: string;
  sharePercentage: number | null;
  ownershipLabel: string;
  kycVerified: boolean;
}

function getDirectorName(d: Record<string, unknown>): string {
  const name = d.name as string | undefined;
  if (name) return name;
  const pi = d.personalInfo as { fullName?: string } | undefined;
  return (pi?.fullName as string) || "—";
}

function getShareholderName(s: Record<string, unknown>): string {
  const name = s.name as string | undefined;
  if (name) return name;
  const pi = s.personalInfo as { fullName?: string } | undefined;
  return (pi?.fullName as string) || "—";
}

function getSharePercentage(s: Record<string, unknown>): number | null {
  const pct = s.sharePercentage as number | undefined;
  if (typeof pct === "number" && !Number.isNaN(pct)) return pct;
  const alt = s.percentage as number | undefined;
  if (typeof alt === "number" && !Number.isNaN(alt)) return alt;
  return null;
}

function isKycVerified(entity: Record<string, unknown>): boolean {
  const status = String((entity.status as string) ?? "").toUpperCase();
  const approveStatus = String((entity.approveStatus as string) ?? "").toUpperCase();
  return status === "APPROVED" || approveStatus === "APPROVED";
}

export function useCorporateEntities(organizationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  return useQuery({
    queryKey: ["corporate-entities", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const result = await apiClient.get<{
        directors: Array<Record<string, unknown>>;
        shareholders: Array<Record<string, unknown>>;
        corporateShareholders: Array<Record<string, unknown>>;
        directorKycStatus?: DirectorKycStatus | null;
      }>(`/v1/organizations/issuer/${organizationId}/corporate-entities`);
      if (!result.success) {
        throw new Error(result.error.message);
      }
      const raw = result.data;
      const directors = raw.directors ?? [];
      const shareholders = raw.shareholders ?? [];
      const directorsDisplay: DirectorDisplay[] = directors.map((d) => ({
        name: getDirectorName(d),
        ownershipLabel: "Director",
        kycVerified: isKycVerified(d),
      }));
      const shareholdersDisplay: ShareholderDisplay[] = shareholders.map((s) => {
        const pct = getSharePercentage(s);
        const ownershipLabel = pct != null ? `${pct}% ownership` : "—";
        return {
          name: getShareholderName(s),
          sharePercentage: pct,
          ownershipLabel,
          kycVerified: isKycVerified(s),
        };
      });
      return {
        ...raw,
        directorsDisplay,
        shareholdersDisplay,
        directorKycStatus: raw.directorKycStatus ?? null,
      };
    },
    enabled: !!organizationId,
  });
}
