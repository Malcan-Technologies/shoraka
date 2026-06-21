import { Request, Response, NextFunction, Router } from "express";
import { UserRole, WithdrawalType } from "@prisma/client";
import {
  requirePermission,
  requireAnyPermission,
  requireRole,
  userHasPermission,
} from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { noteService } from "./service";
import { shorakaStpService } from "../shoraka-stp/shoraka-stp-service";
import {
  applicationIdParamSchema,
  bucketAccountParamSchema,
  bucketActivityQuerySchema,
  createInvestmentSchema,
  createNoteFromApplicationSchema,
  createWithdrawalSchema,
  defaultMarkSchema,
  getAdminInvestmentsQuerySchema,
  getNotesQuerySchema,
  idParamSchema,
  noteSettlementParamsSchema,
  invoiceIdParamSchema,
  lateChargeSchema,
  overdueLateChargeSchema,
  paymentReviewSchema,
  recordPaymentSchema,
  settlementActionSchema,
  settlementPreviewSchema,
  investorBalanceActivityQuerySchema,
  investorBalanceStatementQuerySchema,
  investorInvestmentsQuerySchema,
  investorPortfolioHistoryQuerySchema,
  investorPortfolioQuerySchema,
  testInvestorBalanceTopupSchema,
  updateNoteFeaturedSchema,
  updateNoteDraftSchema,
  updatePlatformFinanceSettingsSchema,
  updateWithdrawalBeneficiarySchema,
  createInvestorWithdrawalSchema,
  getInvestorWithdrawalsQuerySchema,
} from "./schemas";

function getActor(req: Request, res: Response, portal: string) {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }
  const userAgent = Array.isArray(req.headers["user-agent"])
    ? req.headers["user-agent"][0]
    : req.headers["user-agent"];
  return {
    userId: req.user.user_id,
    role: req.activeRole ?? req.user.roles[0],
    portal,
    ipAddress: req.ip,
    userAgent,
    correlationId: res.locals.correlationId,
  };
}

function send(res: Response, data: unknown, status = 200) {
  res.status(status).json({
    success: true,
    data,
    correlationId: res.locals.correlationId || "unknown",
  });
}

async function assertWithdrawalManagePermission(req: Request, withdrawalId: string) {
  const withdrawal = await prisma.withdrawalInstruction.findUnique({
    where: { id: withdrawalId },
    select: { withdrawal_type: true },
  });
  if (!withdrawal) {
    throw new AppError(404, "WITHDRAWAL_NOT_FOUND", "Withdrawal instruction not found");
  }

  if (withdrawal.withdrawal_type === WithdrawalType.INVESTOR_WITHDRAWAL) {
    if (!userHasPermission(req, "investor_withdrawals.manage")) {
      throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
    }
    return;
  }

  if (!userHasPermission(req, "notes.disbursement.manage")) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
  }
}

export const adminNotesRouter = Router();
export const marketplaceRouter = Router();
export const publicMarketplaceRouter = Router();
export const issuerNotesRouter = Router();
export const investorNotesRouter = Router();

adminNotesRouter.use(requireRole(UserRole.ADMIN));

adminNotesRouter.get(
  "/",
  requirePermission("notes.view"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = getNotesQuerySchema.parse(req.query);
    send(res, await noteService.listAdminNotes(params));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.get(
  "/source-invoices",
  requirePermission("notes.view"),
  async (_req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await noteService.listSourceInvoicesForNotes());
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.get(
  "/bucket-balances",
  requireAnyPermission("bucket_balances.view", "dashboard.finance.view"),
  async (_req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await noteService.listLedgerBucketBalances());
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.get(
  "/bucket-balances/:accountCode/activity",
  requirePermission("bucket_balances.view"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountCode } = bucketAccountParamSchema.parse(req.params);
    const query = bucketActivityQuerySchema.parse(req.query);
    send(res, await noteService.listLedgerBucketActivity(accountCode, query));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.get(
  "/action-count",
  requirePermission("notes.view"),
  async (_req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await noteService.getActionRequiredCount());
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.get(
  "/pending-repayments",
  requirePermission("repayments.view"),
  async (_req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await noteService.listPendingRepayments());
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.get(
  "/pending-service-fee-trustee-letters",
  requirePermission("service_fee.view"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      send(res, await noteService.listPendingServiceFeeTrusteeLetters());
    } catch (error) {
      next(error);
    }
  }
);

adminNotesRouter.post(
  "/from-application/:applicationId",
  requirePermission("notes.create"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { applicationId } = applicationIdParamSchema.parse(req.params);
      const input = createNoteFromApplicationSchema.parse(req.body);
      send(res, await noteService.createFromApplication(applicationId, input, getActor(req, res, "ADMIN")), 201);
    } catch (error) {
      next(error);
    }
  }
);

adminNotesRouter.post(
  "/from-invoice/:invoiceId",
  requirePermission("notes.create"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { invoiceId } = invoiceIdParamSchema.parse(req.params);
      const input = createNoteFromApplicationSchema.parse(req.body);
      send(res, await noteService.createFromInvoice(invoiceId, input, getActor(req, res, "ADMIN")), 201);
    } catch (error) {
      next(error);
    }
  }
);

adminNotesRouter.get(
  "/:id",
  requirePermission("notes.view"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.getAdminNoteDetail(id));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/offers/invoices/resign",
  requirePermission("notes.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = getActor(req, res, "ADMIN");
    const { id } = idParamSchema.parse(req.params);
    send(
      res,
      await noteService.resignSourceInvoiceOffer(id, actor.userId, {
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
        deviceInfo: null,
      })
    );
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.patch(
  "/:id/draft",
  requirePermission("notes.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = updateNoteDraftSchema.parse(req.body);
    send(res, await noteService.updateDraft(id, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.patch(
  "/:id/featured",
  requirePermission("notes.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = updateNoteFeaturedSchema.parse(req.body);
    send(res, await noteService.updateFeaturedSettings(id, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/publish",
  requirePermission("notes.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.publish(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/unpublish",
  requirePermission("notes.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.unpublish(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/funding/close",
  requirePermission("notes.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.closeFunding(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/funding/fail",
  requirePermission("notes.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.failFunding(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/activate",
  requirePermission("notes.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.activate(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.get(
  "/:id/events",
  requirePermission("notes.view"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.listEvents(id));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.get(
  "/:id/ledger",
  requirePermission("notes.view"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.listLedger(id));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/payments",
  requirePermission("notes.repayment.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = recordPaymentSchema.parse(req.body);
    send(res, await noteService.recordPayment(id, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/payments/:paymentId/approve",
  requirePermission("notes.repayment.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const paymentId = String(req.params.paymentId ?? "");
    send(res, await noteService.approvePayment(id, paymentId, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/payments/:paymentId/reject",
  requirePermission("notes.repayment.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const paymentId = String(req.params.paymentId ?? "");
    const input = paymentReviewSchema.parse(req.body);
    send(res, await noteService.rejectPayment(id, paymentId, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/settlements/preview",
  requirePermission("notes.settlement.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = settlementPreviewSchema.parse(req.body);
    send(res, await noteService.previewSettlement(id, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/settlements/approve",
  requirePermission("notes.settlement.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { settlementId } = settlementActionSchema.parse(req.body);
    send(res, await noteService.approveSettlement(id, settlementId, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/settlements/post",
  requirePermission("notes.settlement.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { settlementId } = settlementActionSchema.parse(req.body);
    send(res, await noteService.postSettlement(id, settlementId, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/settlements/:settlementId/service-fee/generate-trustee-letter",
  requirePermission("notes.disbursement.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, settlementId } = noteSettlementParamsSchema.parse(req.params);
      send(
        res,
        await noteService.generateServiceFeeTrusteeLetter(id, settlementId, getActor(req, res, "ADMIN"))
      );
    } catch (error) {
      next(error);
    }
  }
);

adminNotesRouter.post(
  "/:id/settlements/:settlementId/service-fee/mark-submitted-to-trustee",
  requirePermission("notes.disbursement.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, settlementId } = noteSettlementParamsSchema.parse(req.params);
      send(
        res,
        await noteService.markServiceFeeTrusteeLetterSubmitted(
          id,
          settlementId,
          getActor(req, res, "ADMIN")
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

adminNotesRouter.post(
  "/:id/settlements/:settlementId/service-fee/mark-completed",
  requirePermission("notes.disbursement.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, settlementId } = noteSettlementParamsSchema.parse(req.params);
      send(
        res,
        await noteService.markServiceFeeTrusteeInstructionCompleted(
          id,
          settlementId,
          getActor(req, res, "ADMIN")
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

adminNotesRouter.post(
  "/:id/late-charge/calculate",
  requirePermission("notes.default.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    lateChargeSchema.parse(req.body);
    send(res, await noteService.calculateLateCharge(req.body));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/late-charge/check-overdue",
  requirePermission("notes.default.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = overdueLateChargeSchema.parse(req.body);
    send(res, await noteService.applyOverdueLateCharge(id, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/late-charge/approve",
  requirePermission("notes.default.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = lateChargeSchema.parse(req.body);
    send(res, await noteService.approveLateCharge(id, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/arrears/generate-letter",
  requirePermission("notes.default.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.generateNoteLetter(id, "arrears", getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/default/generate-letter",
  requirePermission("notes.default.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.generateNoteLetter(id, "default", getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

adminNotesRouter.post(
  "/:id/default/mark",
  requirePermission("notes.default.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = defaultMarkSchema.parse(req.body);
    send(res, await noteService.markDefault(id, reason, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

marketplaceRouter.use(requireRole(UserRole.INVESTOR));

marketplaceRouter.get("/notes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = getNotesQuerySchema.parse(req.query);
    send(res, await noteService.listMarketplace(params));
  } catch (error) {
    next(error);
  }
});

marketplaceRouter.get("/notes/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.getMarketplaceNoteDetail(id));
  } catch (error) {
    next(error);
  }
});

marketplaceRouter.post("/notes/:id/investments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = createInvestmentSchema.parse(req.body);
    send(res, await noteService.createInvestment(id, input, getActor(req, res, "INVESTOR")), 201);
  } catch (error) {
    next(error);
  }
});

publicMarketplaceRouter.get("/notes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = getNotesQuerySchema.parse(req.query);
    send(res, await noteService.listMarketplace(params));
  } catch (error) {
    next(error);
  }
});

publicMarketplaceRouter.get("/notes/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.getMarketplaceNoteDetail(id));
  } catch (error) {
    next(error);
  }
});

investorNotesRouter.use(requireRole(UserRole.INVESTOR));

investorNotesRouter.get("/investments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = investorInvestmentsQuerySchema.parse(req.query);
    send(
      res,
      await noteService.listInvestorInvestments(getActor(req, res, "INVESTOR").userId, query)
    );
  } catch (error) {
    next(error);
  }
});

investorNotesRouter.get("/portfolio", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = investorPortfolioQuerySchema.parse(req.query);
    send(res, await noteService.getInvestorPortfolio(getActor(req, res, "INVESTOR").userId, query));
  } catch (error) {
    next(error);
  }
});

investorNotesRouter.get("/portfolio/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = investorPortfolioHistoryQuerySchema.parse(req.query);
    send(res, await noteService.getInvestorPortfolioHistory(getActor(req, res, "INVESTOR").userId, query));
  } catch (error) {
    next(error);
  }
});

investorNotesRouter.get("/balance/activity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = investorBalanceActivityQuerySchema.parse(req.query);
    send(res, await noteService.listInvestorBalanceActivity(getActor(req, res, "INVESTOR").userId, query));
  } catch (error) {
    next(error);
  }
});

investorNotesRouter.get("/balance/statement", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = investorBalanceStatementQuerySchema.parse(req.query);
    const result = await noteService.exportInvestorBalanceStatement(
      getActor(req, res, "INVESTOR").userId,
      query
    );
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  } catch (error) {
    next(error);
  }
});

investorNotesRouter.post("/balance/test-topup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = testInvestorBalanceTopupSchema.parse(req.body);
    const actor = getActor(req, res, "INVESTOR");
    send(
      res,
      await noteService.testTopUpInvestorBalance(actor, input)
    );
  } catch (error) {
    next(error);
  }
});

investorNotesRouter.post("/balance/withdraw", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createInvestorWithdrawalSchema.parse(req.body);
    const actor = getActor(req, res, "INVESTOR");
    send(res, await noteService.createInvestorWithdrawal(input, actor), 201);
  } catch (error) {
    next(error);
  }
});

issuerNotesRouter.use(requireRole(UserRole.ISSUER));

issuerNotesRouter.get("/notes", async (req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await noteService.listIssuerNotes(getActor(req, res, "ISSUER").userId));
  } catch (error) {
    next(error);
  }
});

issuerNotesRouter.get("/notes/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.getIssuerNote(id, getActor(req, res, "ISSUER").userId));
  } catch (error) {
    next(error);
  }
});

issuerNotesRouter.get("/notes/:id/payment-instructions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await noteService.getIssuerNote(id, getActor(req, res, "ISSUER").userId);
    send(res, noteService.getPaymentInstructions(id));
  } catch (error) {
    next(error);
  }
});

issuerNotesRouter.get("/notes/:id/ledger", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await noteService.getIssuerNote(id, getActor(req, res, "ISSUER").userId);
    send(res, await noteService.listLedger(id));
  } catch (error) {
    next(error);
  }
});

issuerNotesRouter.post("/notes/:id/shoraka-certificate/view-url", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(
      res,
      await noteService.getIssuerShorakaCertificateViewUrl(id, getActor(req, res, "ISSUER").userId)
    );
  } catch (error) {
    next(error);
  }
});

issuerNotesRouter.post("/notes/:id/payments/on-behalf-of-paymaster", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await noteService.getIssuerNote(id, getActor(req, res, "ISSUER").userId);
    const input = recordPaymentSchema.parse({ ...req.body, source: "ISSUER_ON_BEHALF" });
    send(res, await noteService.recordPayment(id, input, getActor(req, res, "ISSUER")), 201);
  } catch (error) {
    next(error);
  }
});

export const platformFinanceSettingsRouter = Router();
platformFinanceSettingsRouter.use(requireRole(UserRole.ADMIN));
platformFinanceSettingsRouter.get(
  "/",
  requirePermission("platform_settings.view"),
  async (_req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await noteService.getPlatformFinanceSettings());
  } catch (error) {
    next(error);
  }
  }
);
platformFinanceSettingsRouter.patch(
  "/",
  requirePermission("platform_settings.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updatePlatformFinanceSettingsSchema.parse(req.body);
    send(res, await noteService.updatePlatformFinanceSettings(input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

export const adminInvestmentsRouter = Router();
adminInvestmentsRouter.use(requireRole(UserRole.ADMIN));

adminInvestmentsRouter.get(
  "/",
  requirePermission("investments.view"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = getAdminInvestmentsQuerySchema.parse(req.query);
    send(res, await noteService.listAdminInvestments(params));
  } catch (error) {
    next(error);
  }
  }
);

export const withdrawalsRouter = Router();
withdrawalsRouter.use(requireRole(UserRole.ADMIN));

withdrawalsRouter.get(
  "/",
  requirePermission("investor_withdrawals.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = getInvestorWithdrawalsQuerySchema.parse(req.query);
      send(res, await noteService.listInvestorWithdrawals(query));
    } catch (error) {
      next(error);
    }
  }
);

withdrawalsRouter.get(
  "/pending-issuer-payouts",
  requirePermission("disbursements.view"),
  async (_req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await noteService.listPendingIssuerPayouts());
  } catch (error) {
    next(error);
  }
  }
);

withdrawalsRouter.get(
  "/pending-investor-withdrawals",
  requirePermission("investor_withdrawals.view"),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      send(res, await noteService.getPendingInvestorWithdrawalsCount());
    } catch (error) {
      next(error);
    }
  }
);

withdrawalsRouter.get(
  "/:id",
  requirePermission("investor_withdrawals.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      send(res, await noteService.getInvestorWithdrawal(id));
    } catch (error) {
      next(error);
    }
  }
);

withdrawalsRouter.post(
  "/",
  requirePermission("notes.disbursement.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createWithdrawalSchema.parse(req.body);
    send(res, await noteService.createWithdrawal(input, getActor(req, res, "ADMIN")), 201);
  } catch (error) {
    next(error);
  }
  }
);
withdrawalsRouter.post(
  "/:id/generate-letter",
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await assertWithdrawalManagePermission(req, id);
    send(res, await noteService.generateWithdrawalLetter(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);
withdrawalsRouter.post(
  "/:id/mark-submitted-to-trustee",
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await assertWithdrawalManagePermission(req, id);
    send(res, await noteService.markWithdrawalSubmitted(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);
withdrawalsRouter.post(
  "/:id/mark-completed",
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await assertWithdrawalManagePermission(req, id);
    send(res, await noteService.markWithdrawalCompleted(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
  }
);

// Shoraka Al-Amin STP integration (Phase 1: manual admin-triggered)
// Routes are mounted under /v1/admin/withdrawals.
withdrawalsRouter.post("/:id/shoraka/submit-order", requirePermission("notes.disbursement.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await shorakaStpService.submitOrderForWithdrawal(id));
  } catch (error) {
    next(error);
  }
});

withdrawalsRouter.post("/:id/shoraka/query-status", requirePermission("notes.disbursement.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await shorakaStpService.queryStatusForWithdrawal(id);
    send(res, await shorakaStpService.getStateForWithdrawal(id));
  } catch (error) {
    next(error);
  }
});

withdrawalsRouter.post("/:id/shoraka/fetch-certificate", requirePermission("notes.disbursement.manage"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await shorakaStpService.fetchCertificateForWithdrawal(id));
  } catch (error) {
    next(error);
  }
});

withdrawalsRouter.get("/:id/shoraka", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await shorakaStpService.getStateForWithdrawal(id));
  } catch (error) {
    next(error);
  }
});
withdrawalsRouter.patch("/:id/beneficiary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await assertWithdrawalManagePermission(req, id);
    const body = updateWithdrawalBeneficiarySchema.parse(req.body);
    send(
      res,
      await noteService.updateWithdrawalBeneficiary(id, body.beneficiarySnapshot, getActor(req, res, "ADMIN"))
    );
  } catch (error) {
    next(error);
  }
});

