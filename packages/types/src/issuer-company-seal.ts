export const ISSUER_COMPANY_SEAL_S3_PREFIX = "issuer-organizations";

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
