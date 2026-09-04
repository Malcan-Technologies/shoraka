/**
 * Cascade-close an application as REJECTED: non-final children + offer phases.
 * Application status write is included; call from admin final reject only.
 * Caller must void open signing envelopes first — this will not persist REJECTED
 * while DRAFT/SENT/IN_PROGRESS envelopes remain.
 */

import {
  ApplicationStatus,
  ContractStatus,
  getOfferAcceptanceFromOfferDetails,
  InvoiceStatus,
  isInvoiceOnlyFinancingStructure,
} from "@cashsouk/types";
import type { Prisma } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { applyContractCapacityChange } from "../../lib/refresh-contract-facility";
import { patchOfferAcceptanceUnchecked } from "./offer-acceptance";

export const VOIDABLE_ENVELOPE_STATUSES = ["DRAFT", "SENT", "IN_PROGRESS"] as const;
const VOIDABLE_ENVELOPE_STATUS_SET = new Set<string>(VOIDABLE_ENVELOPE_STATUSES);

export function getVoidableEnvelopeIds(
  envelopes: Array<{ id: string; status: string | null | undefined }>
): string[] {
  return envelopes
    .filter((envelope) => VOIDABLE_ENVELOPE_STATUS_SET.has(String(envelope.status ?? "").toUpperCase()))
    .map((envelope) => envelope.id);
}

const SKIP_REJECT_ENTITY_STATUSES = new Set<string>(["APPROVED", "REJECTED", "WITHDRAWN"]);

export function shouldRejectEntityStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? "").toUpperCase();
  return !SKIP_REJECT_ENTITY_STATUSES.has(normalized);
}

export function rejectOfferDetailsJson(
  offerDetails: unknown
): Prisma.InputJsonValue | undefined {
  if (!offerDetails || typeof offerDetails !== "object") {
    return undefined;
  }
  const record = offerDetails as Record<string, unknown>;
  const acceptance = getOfferAcceptanceFromOfferDetails(record);
  if (!acceptance) {
    return undefined;
  }
  if (acceptance.status === "REJECTED" || acceptance.status === "DECLINED" || acceptance.status === "COMPLETED") {
    return undefined;
  }
  return patchOfferAcceptanceUnchecked(record, { status: "REJECTED" }) as Prisma.InputJsonValue;
}

/**
 * Reject non-final contract/invoices and offer phases inside a transaction.
 * Open signing envelopes must already be voided; otherwise this throws and leaves status unchanged.
 */
export async function closeApplicationAsRejected(applicationId: string): Promise<void> {
  const rejectInTx = async (tx: Prisma.TransactionClient) => {
    const application = await tx.application.findUnique({
      where: { id: applicationId },
      include: {
        contract: {
          select: {
            id: true,
            status: true,
            offer_details: true,
          },
        },
        invoices: {
          select: {
            id: true,
            status: true,
            offer_details: true,
          },
        },
        signing_envelopes: {
          select: { id: true, status: true },
        },
      },
    });

    if (!application) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    const openEnvelopeIds = getVoidableEnvelopeIds(application.signing_envelopes ?? []);
    if (openEnvelopeIds.length > 0) {
      throw new AppError(
        409,
        "INVALID_STATE",
        "Cannot reject application while signing packages are still open"
      );
    }

    const updated = await tx.application.updateMany({
      where: {
        id: applicationId,
        status: { notIn: ["REJECTED", "COMPLETED", "WITHDRAWN", "ARCHIVED"] },
      },
      data: { status: ApplicationStatus.REJECTED },
    });
    if (updated.count === 0) {
      throw new Error(`Application cannot be rejected in its current state: ${applicationId}`);
    }

    const contract = application.contract;
    if (contract && shouldRejectEntityStatus(contract.status)) {
      const nextOfferDetails = rejectOfferDetailsJson(contract.offer_details);
      await tx.contract.update({
        where: { id: contract.id },
        data: {
          status: ContractStatus.REJECTED,
          ...(nextOfferDetails !== undefined ? { offer_details: nextOfferDetails } : {}),
        },
      });
    }

    for (const invoice of application.invoices ?? []) {
      if (!shouldRejectEntityStatus(invoice.status)) {
        continue;
      }
      const nextOfferDetails = rejectOfferDetailsJson(invoice.offer_details);
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.REJECTED,
          ...(nextOfferDetails !== undefined ? { offer_details: nextOfferDetails } : {}),
        },
      });
    }
    return application.contract?.id ?? null;
  };

  const preview = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { contract_id: true, financing_structure: true },
  });
  if (
    preview?.contract_id &&
    !isInvoiceOnlyFinancingStructure(preview.financing_structure)
  ) {
    await applyContractCapacityChange(preview.contract_id, prisma, rejectInTx, {
      assertWrite: true,
    });
    return;
  }
  await prisma.$transaction(rejectInTx);
}
