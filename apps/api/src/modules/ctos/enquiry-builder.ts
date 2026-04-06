/**
 * SECTION: CTOS enquiry XML from issuer organization
 * WHY: Map our org record to ENQWS batch record (company vs personal)
 * INPUT: Prisma IssuerOrganization fields
 * OUTPUT: inner `<batch>...</batch>` XML string
 * WHERE USED: ctos report service before SOAP call
 */

import { OrganizationType } from "@prisma/client";
import type { CtosConfig } from "./config";

export interface IssuerOrgCtosInput {
  type: OrganizationType;
  name: string | null;
  registration_number: string | null;
  first_name: string | null;
  last_name: string | null;
  document_number: string | null;
}

export function buildCtosEnquiryXml(cfg: CtosConfig, org: IssuerOrgCtosInput): string {
  let typeCode = "";
  let typeVal = "";
  let icLc = "";
  let nicBr = "";

  if (org.type === OrganizationType.PERSONAL) {
    typeCode = "11";
    typeVal = "I";
    nicBr = (org.document_number ?? "").trim();
    if (!nicBr) {
      throw new Error("Issuer organization is missing document number for CTOS individual enquiry");
    }
  } else {
    typeCode = "24";
    typeVal = "C";
    icLc = (org.registration_number ?? "").trim();
    if (!icLc) {
      throw new Error("Issuer organization is missing registration number for CTOS company enquiry");
    }
  }

  const displayName =
    org.type === OrganizationType.COMPANY
      ? (org.name ?? "").trim()
      : [org.first_name, org.last_name].filter(Boolean).join(" ").trim() || (org.name ?? "").trim();

  if (!displayName) {
    throw new Error("Issuer organization is missing name for CTOS enquiry");
  }

  const refNo = org.type === OrganizationType.COMPANY ? icLc : nicBr;

  return `
<batch no="REQ" output="0" xmlns="http://ws.cmctos.com.my/ctosnet/request">
  <company_code>${cfg.companyCode}</company_code>
  <account_no>${cfg.accountNo}</account_no>
  <user_id>${cfg.userId}</user_id>
  <record_total>1</record_total>
  <records>
    <type code="${typeCode}">${typeVal}</type>
    <ic_lc>${icLc}</ic_lc>
    <nic_br>${nicBr}</nic_br>
    <name>${displayName}</name>
    <ref_no>${refNo}</ref_no>
    <include_ctos>1</include_ctos>
    <include_ccris>1</include_ccris>
    <include_fico>1</include_fico>
  </records>
</batch>`;
}
