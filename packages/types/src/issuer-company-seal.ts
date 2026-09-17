export const ISSUER_COMPANY_SEAL_S3_PREFIX = "issuer-organizations";

export const ISSUER_COMPANY_SEAL_REQUIRED_MESSAGE =
  "Upload a company seal in Organisation before continuing.";

export const ISSUER_COMPANY_SEAL_OWNER_ADMIN_REQUIRED_MESSAGE =
  "A company seal is required. Ask an organisation owner or admin to upload it in Organisation.";

export const COMPANY_SEAL_MANAGE_FORBIDDEN_MESSAGE =
  "Only the organisation owner or an organisation admin can manage the company seal.";

export const ISSUER_COMPANY_SEAL_UPLOAD_LINK_LABEL = "Upload company seal";

export const ISSUER_COMPANY_SEAL_VIEW_LINK_LABEL = "View company seal";

export function canManageIssuerCompanySeal(
  organization:
    | {
        isOwner: boolean;
        members?: Array<{ id: string; role: string }>;
      }
    | null
    | undefined,
  userId: string | null | undefined
): boolean {
  if (!organization) return false;
  if (organization.isOwner) return true;
  if (!userId) return false;
  return (
    organization.members?.some(
      (member) => member.id === userId && member.role === "ORGANIZATION_ADMIN"
    ) === true
  );
}

export type IssuerCompanySealTransparency = "OPAQUE" | "ALPHA";

export type IssuerCompanySealDto = {
  id: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  widthPx: number;
  heightPx: number;
  sha256: string;
  transparencyMode: IssuerCompanySealTransparency;
  createdAt: string;
  supersededAt: string | null;
};

export function issuerCompanySealS3Prefix(organizationId: string): string {
  return `${ISSUER_COMPANY_SEAL_S3_PREFIX}/${organizationId}/company-seals/`;
}

export function parseIssuerOrganizationIdFromCompanySealKey(key: string): string | null {
  const match = /^issuer-organizations\/([^/]+)\/company-seals\//.exec(key.trim());
  const organizationId = match?.[1]?.trim();
  return organizationId || null;
}

export function isIssuerCompanySealS3Key(organizationId: string, key: string): boolean {
  const prefix = issuerCompanySealS3Prefix(organizationId);
  return key.startsWith(prefix) && !key.includes("..") && key !== prefix;
}
