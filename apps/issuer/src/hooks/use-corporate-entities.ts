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
  sharePercentage: number | null;
  ownershipLabel: string;
  kycVerified: boolean;
}

export interface ShareholderDisplay {
  name: string;
  sharePercentage: number | null;
  ownershipLabel: string;
  kycVerified: boolean;
}

function isDirector(role: string | null | undefined): boolean {
  if (!role) return false;
  return role.toLowerCase().includes("director");
}

function isShareholder(role: string | null | undefined): boolean {
  if (!role) return false;
  return role.toLowerCase().includes("shareholder");
}

function extractOwnershipFromRole(role: string | null | undefined): number | null {
  if (!role) return null;
  
  // Extract all percentages from role string (e.g., "Director, Shareholder (10%), Shareholder (10%)")
  const matches = role.match(/\((\d+)%\)/g);
  if (!matches || matches.length === 0) return null;
  
  // Extract unique percentages and sum them (in case there are different percentages)
  const percentages = new Set<number>();
  matches.forEach((match) => {
    const pct = Number.parseInt(match.replace(/[()%]/g, ""), 10);
    if (!Number.isNaN(pct)) {
      percentages.add(pct);
    }
  });
  
  // If all percentages are the same, return that value
  // If different, sum them (though this shouldn't happen normally)
  if (percentages.size === 1) {
    return Array.from(percentages)[0];
  } else if (percentages.size > 1) {
    // Sum all unique percentages
    return Array.from(percentages).reduce((sum, pct) => sum + pct, 0);
  }
  
  return null;
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
      const directorKycStatus = raw.directorKycStatus ?? null;
      
      // Process directorKycStatus.directors - this contains both directors and shareholders
      const directorsDisplay: DirectorDisplay[] = [];
      const shareholdersDisplay: ShareholderDisplay[] = [];
      
      if (directorKycStatus?.directors && directorKycStatus.directors.length > 0) {
        directorKycStatus.directors.forEach((entry: DirectorKycEntry) => {
          const sharePercentage = extractOwnershipFromRole(entry.role);
          const ownershipLabel = sharePercentage != null ? `${sharePercentage}% ownership` : "—";
          const kycVerified = entry.kycStatus === "APPROVED";
          
          const displayItem = {
            name: entry.name,
            sharePercentage,
            ownershipLabel,
            kycVerified,
          };
          
          // Determine if this person is a director, shareholder, or both
          const isDir = isDirector(entry.role);
          const isSh = isShareholder(entry.role);
          
          if (isDir) {
            // Add to directors (even if also a shareholder)
            directorsDisplay.push(displayItem as DirectorDisplay);
          }
          
          if (isSh) {
            // Add to shareholders (even if also a director)
            shareholdersDisplay.push(displayItem as ShareholderDisplay);
          }
        });
      }
      
      return {
        ...raw,
        directorsDisplay,
        shareholdersDisplay,
        directorKycStatus,
      };
    },
    enabled: !!organizationId,
  });
}
