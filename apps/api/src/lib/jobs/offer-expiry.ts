/**
 * Offer expiry job: withdraws contract and invoice offers that have exceeded their expiry date.
 * Runs as a cron job; can also be invoked manually via run-offer-expiry script for testing.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { logApplicationActivity } from "../../modules/applications/logs/service";
import { ActivityPortal } from "../../modules/applications/logs/types";
import { WithdrawReason } from "@cashsouk/types";
import { computeApplicationStatus } from "../../modules/applications/lifecycle";
import { ApplicationStatus, ContractStatus, InvoiceStatus } from "@cashsouk/types";

/** System user ID for cron-initiated actions. Displays as "System" in activity logs. */
const SYSTEM_USER_ID = "SYS";

export type OfferExpiryResult = {
  contractsWithdrawn: string[];
  invoicesWithdrawn: string[];
  applicationsUpdated: string[];
  systemUserId: string | null;
  error?: string;
};

async function ensureSystemUser(): Promise<string> {
  await prisma.user.upsert({
    where: { user_id: SYSTEM_USER_ID },
    create: {
      user_id: SYSTEM_USER_ID,
      email: "system@internal.cashsouk",
      cognito_sub: "system-internal-no-login",
      cognito_username: "system-internal",
      roles: [],
      first_name: "System",
      last_name: "",
      investor_account: [],
      issuer_account: [],
    },
    update: { first_name: "System", last_name: "" },
  });
  return SYSTEM_USER_ID;
}

export async function runOfferExpiryJob(): Promise<OfferExpiryResult> {
  const result: OfferExpiryResult = {
    contractsWithdrawn: [],
    invoicesWithdrawn: [],
    applicationsUpdated: [],
    systemUserId: null,
  };

  try {
    result.systemUserId = await ensureSystemUser();
  } catch (err) {
    logger.warn({ err }, "Offer expiry job: could not ensure System user, activity logs will be skipped");
  }

  const log = (params: {
    applicationId?: string;
    eventType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) => {
    if (result.systemUserId) {
      logApplicationActivity({
        userId: result.systemUserId,
        applicationId: params.applicationId,
        eventType: params.eventType,
        portal: ActivityPortal.ADMIN,
        entityId: params.entityId,
        metadata: { ...params.metadata, triggered_by: "offer_expiry_cron" },
      });
    }
  };

  try {
    const now = new Date();

    const expiredContracts = await prisma.$queryRaw<
      { id: string; issuer_organization_id: string; contract_number: string | null }[]
    >(
      Prisma.sql`
        SELECT id, issuer_organization_id, contract_details->>'number' as contract_number
        FROM contracts
        WHERE status::text = 'OFFER_SENT'
          AND offer_details IS NOT NULL
          AND offer_details->>'expires_at' IS NOT NULL
          AND (offer_details->>'expires_at')::timestamptz < ${now}
      `
    );

    for (const contract of expiredContracts) {
      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          status: "WITHDRAWN",
          withdraw_reason: WithdrawReason.OFFER_EXPIRED,
          offer_details: Prisma.JsonNull,
        },
      });
      result.contractsWithdrawn.push(contract.id);

      const applications = await prisma.application.findMany({
        where: { contract_id: contract.id },
        select: { id: true },
      });
      const systemUserId = result.systemUserId ?? SYSTEM_USER_ID;
      for (const app of applications) {
        await prisma.application.update({
          where: { id: app.id },
          data: { status: ApplicationStatus.WITHDRAWN },
        });
        await prisma.applicationReview.upsert({
          where: {
            application_id_section: {
              application_id: app.id,
              section: "contract_details",
            },
          },
          create: {
            application_id: app.id,
            section: "contract_details",
            status: "WITHDRAWN",
            reviewer_user_id: systemUserId,
            reviewed_at: new Date(),
          },
          update: {
            status: "WITHDRAWN",
            reviewer_user_id: systemUserId,
            reviewed_at: new Date(),
          },
        });
        result.applicationsUpdated.push(app.id);
        log({
          applicationId: app.id,
          eventType: "CONTRACT_WITHDRAWN",
          entityId: contract.id,
          metadata: {
            withdraw_reason: WithdrawReason.OFFER_EXPIRED,
            contract_id: contract.id,
            contract_number: contract.contract_number ?? undefined,
            trigger: "offer_expired",
          },
        });
        log({
          applicationId: app.id,
          eventType: "APPLICATION_WITHDRAWN",
          metadata: {
            withdraw_reason: WithdrawReason.OFFER_EXPIRED,
            contract_id: contract.id,
            trigger: "offer_expired",
          },
        });
      }
    }

    const expiredInvoices = await prisma.$queryRaw<
      { id: string; application_id: string; contract_id: string | null; invoice_number: string | null }[]
    >(
      Prisma.sql`
        SELECT id, application_id, contract_id, details->>'number' as invoice_number
        FROM invoices
        WHERE status::text = 'OFFER_SENT'
          AND offer_details IS NOT NULL
          AND offer_details->>'expires_at' IS NOT NULL
          AND (offer_details->>'expires_at')::timestamptz < ${now}
      `
    );

    for (const invoice of expiredInvoices) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "WITHDRAWN",
          withdraw_reason: WithdrawReason.OFFER_EXPIRED,
          offer_details: Prisma.JsonNull,
        },
      });
      result.invoicesWithdrawn.push(invoice.id);

      log({
        applicationId: invoice.application_id,
        eventType: "INVOICE_WITHDRAWN",
        entityId: invoice.id,
        metadata: {
          withdraw_reason: WithdrawReason.OFFER_EXPIRED,
          trigger: "offer_expired",
          invoice_number: invoice.invoice_number ?? undefined,
        },
      });

      const app = await prisma.application.findUnique({
        where: { id: invoice.application_id },
        include: {
          contract: { select: { status: true } },
          invoices: { select: { status: true } },
        },
      });
      if (app) {
        const contract = app.contract
          ? { status: app.contract.status as ContractStatus }
          : null;
        const isInvoiceOnly =
          (app.financing_structure as { structure_type?: string } | null)?.structure_type === "invoice_only";
        const newStatus = computeApplicationStatus(
          contract,
          app.invoices.map((i) => ({ status: i.status as InvoiceStatus })),
          app.status as ApplicationStatus,
          { isInvoiceOnly }
        );
        const currentStatus = app.status as ApplicationStatus;
        if (newStatus !== currentStatus) {
          await prisma.application.update({
            where: { id: invoice.application_id },
            data: { status: newStatus },
          });
          if (!result.applicationsUpdated.includes(invoice.application_id)) {
            result.applicationsUpdated.push(invoice.application_id);
          }
          if (newStatus === ApplicationStatus.WITHDRAWN) {
            log({
              applicationId: invoice.application_id,
              eventType: "APPLICATION_WITHDRAWN",
              metadata: {
                withdraw_reason: WithdrawReason.OFFER_EXPIRED,
                trigger: "all_invoices_withdrawn",
              },
            });
          }
        }
      }
    }

    if (
      result.contractsWithdrawn.length > 0 ||
      result.invoicesWithdrawn.length > 0
    ) {
      logger.info(
        {
          contractsWithdrawn: result.contractsWithdrawn.length,
          invoicesWithdrawn: result.invoicesWithdrawn.length,
          applicationsUpdated: result.applicationsUpdated.length,
        },
        "Offer expiry job completed"
      );
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    logger.error({ err, result }, "Offer expiry job failed");
    throw err;
  }

  return result;
}
