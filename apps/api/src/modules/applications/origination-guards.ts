import {
  buildOriginationPhaseInput,
  canWithdrawApplication,
  resolveOriginationPhase,
} from "@cashsouk/types";
import { overlayStoredCapacityOnApplicationContract } from "../../lib/refresh-contract-facility";
import { extractPrimaryOfferAcceptanceStatus } from "./offer-application-status";

export type ApplicationOriginationContext = {
  status: string;
  contract?: { status?: string | null; offer_details?: unknown } | null;
  invoices?: Array<{ status?: string | null; contract_id?: string | null; offer_details?: unknown }>;
  financing_structure?: unknown;
  signing_envelopes?: Array<{ status?: string | null }>;
};

export function resolveApplicationOriginationPhase(
  application: ApplicationOriginationContext
) {
  return resolveOriginationPhase(
    buildOriginationPhaseInput({
      applicationStatus: application.status,
      contract: application.contract,
      invoices: application.invoices,
      offerAcceptanceStatus: extractPrimaryOfferAcceptanceStatus({
        financing_structure: application.financing_structure as {
          structure_type?: string;
        } | null,
        contract: application.contract,
        invoices: application.invoices,
      }),
      signingEnvelopes: application.signing_envelopes,
    })
  );
}

export function canWithdrawApplicationRecord(application: ApplicationOriginationContext): boolean {
  return canWithdrawApplication(resolveApplicationOriginationPhase(application));
}

export function enrichApplicationOriginationFields<
  T extends ApplicationOriginationContext & { archived_at?: Date | null },
>(application: T, signingEnvelopes?: Array<{ status?: string | null }>) {
  const envelopes = signingEnvelopes ?? application.signing_envelopes ?? [];
  const context: ApplicationOriginationContext = {
    ...application,
    signing_envelopes: envelopes,
  };
  return overlayStoredCapacityOnApplicationContract({
    ...application,
    canWithdraw: canWithdrawApplicationRecord(context),
    archivedAt: application.archived_at ?? null,
  });
}
