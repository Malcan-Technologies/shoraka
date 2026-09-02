import type { CertificateAudience, CertificateSnapshotInvestor, InvestmentNoteCertificateSnapshot } from "./types";

export type CertificateRenderAudienceInput = {
  audience: CertificateAudience;
  investorOrganizationId?: string | null;
};

const HIDDEN = "—";

export function visibleCertificateInvestors(
  snapshot: InvestmentNoteCertificateSnapshot,
  input: CertificateRenderAudienceInput
): CertificateSnapshotInvestor[] {
  if (input.audience === "INVESTOR") {
    const selfId = input.investorOrganizationId;
    return snapshot.investors.filter((row) => row.investorOrganizationId === selfId);
  }
  return snapshot.investors;
}

export function issuerLegalNameForAudience(
  snapshot: InvestmentNoteCertificateSnapshot,
  audience: CertificateAudience
): string {
  return audience === "INVESTOR" ? HIDDEN : snapshot.note.issuerLegalName;
}

export function companyRegistrationForAudience(
  snapshot: InvestmentNoteCertificateSnapshot,
  audience: CertificateAudience
): string {
  return audience === "INVESTOR" ? HIDDEN : snapshot.note.companyRegistrationNumber;
}

export function investorNameForAudience(name: string, audience: CertificateAudience): string {
  if (audience === "ISSUER") return HIDDEN;
  return name;
}
