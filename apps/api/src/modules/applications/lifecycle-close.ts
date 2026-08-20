/**
 * Cascade-close an application as REJECTED: non-final children + offer phases.
 * Application status write is included; call from admin final reject only.
 */

import {
  ApplicationStatus,
  ContractStatus,
  getOfferAcceptanceFromOfferDetails,
  InvoiceStatus,
} from "@cashsouk/types";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { patchOfferAcceptanceUnchecked } from "./offer-acceptance";

const VOIDABLE_ENVELOPE_STATUSES = ["DRAFT", "SENT", "IN_PROGRESS"] as const;

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

export type CloseApplicationAsRejectedResult = {
  voidEnvelopeIds: string[];
};

/**
 * Reject non-final contract/invoices and offer phases inside a transaction.
 * Returns envelope ids that should be voided after commit (signing service side effects).
 */
export async function closeApplicationAsRejected(
  applicationId: string
): Promise<CloseApplicationAsRejectedResult> {
  const application = await prisma.application.findUnique({
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

  const voidEnvelopeIds =
    application.signing_envelopes
      ?.filter((envelope) =>
        VOIDABLE_ENVELOPE_STATUSES.includes(
          envelope.status as (typeof VOIDABLE_ENVELOPE_STATUSES)[number]
        )
      )
      .map((envelope) => envelope.id) ?? [];

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: applicationId },
      data: { status: ApplicationStatus.REJECTED },
    });

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
  });

  return { voidEnvelopeIds };
}
