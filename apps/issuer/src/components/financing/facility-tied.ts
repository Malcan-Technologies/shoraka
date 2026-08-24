import { formatContractReference } from "@cashsouk/types";

export type IssuerFacilityLink = {
  href: string;
  label: string;
};

export function resolveIssuerFacilityLink(input: {
  contractId?: string | null;
  displayReference?: string | null;
}): IssuerFacilityLink | null {
  const contractId = input.contractId?.trim();
  if (!contractId) return null;
  return {
    href: `/financing/contracts/${encodeURIComponent(contractId)}`,
    label: formatContractReference({
      displayReference: input.displayReference,
      id: contractId,
    }),
  };
}
