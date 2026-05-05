import { Request, Response, NextFunction, Router } from "express";
import { UserRole } from "@prisma/client";
import { requireRole } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { noteService } from "./service";
import {
  applicationIdParamSchema,
  bucketAccountParamSchema,
  bucketActivityQuerySchema,
  createInvestmentSchema,
  createNoteFromApplicationSchema,
  createWithdrawalSchema,
  defaultMarkSchema,
  getNotesQuerySchema,
  idParamSchema,
  invoiceIdParamSchema,
  lateChargeSchema,
  overdueLateChargeSchema,
  paymentReviewSchema,
  recordPaymentSchema,
  settlementActionSchema,
  settlementPreviewSchema,
  testInvestorBalanceTopupSchema,
  updateNoteFeaturedSchema,
  updateNoteDraftSchema,
  updatePlatformFinanceSettingsSchema,
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

export const adminNotesRouter = Router();
export const marketplaceRouter = Router();
export const publicMarketplaceRouter = Router();
export const issuerNotesRouter = Router();
export const investorNotesRouter = Router();

adminNotesRouter.use(requireRole(UserRole.ADMIN));

adminNotesRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = getNotesQuerySchema.parse(req.query);
    send(res, await noteService.listAdminNotes(params));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.get("/source-invoices", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await noteService.listSourceInvoicesForNotes());
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.get("/bucket-balances", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await noteService.listLedgerBucketBalances());
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.get("/bucket-balances/:accountCode/activity", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountCode } = bucketAccountParamSchema.parse(req.params);
    const query = bucketActivityQuerySchema.parse(req.query);
    send(res, await noteService.listLedgerBucketActivity(accountCode, query));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.get("/action-count", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await noteService.getActionRequiredCount());
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post(
  "/from-application/:applicationId",
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

adminNotesRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.getAdminNoteDetail(id));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.patch("/:id/draft", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = updateNoteDraftSchema.parse(req.body);
    send(res, await noteService.updateDraft(id, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.patch("/:id/featured", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = updateNoteFeaturedSchema.parse(req.body);
    send(res, await noteService.updateFeaturedSettings(id, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/publish", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.publish(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/unpublish", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.unpublish(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/funding/close", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.closeFunding(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/funding/fail", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.failFunding(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/activate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.activate(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.get("/:id/events", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.listEvents(id));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.get("/:id/ledger", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.listLedger(id));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/payments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = recordPaymentSchema.parse(req.body);
    send(res, await noteService.recordPayment(id, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/payments/:paymentId/approve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const paymentId = String(req.params.paymentId ?? "");
    send(res, await noteService.approvePayment(id, paymentId, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/payments/:paymentId/reject", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const paymentId = String(req.params.paymentId ?? "");
    const input = paymentReviewSchema.parse(req.body);
    send(res, await noteService.rejectPayment(id, paymentId, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/settlements/preview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = settlementPreviewSchema.parse(req.body);
    send(res, await noteService.previewSettlement(id, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/settlements/approve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { settlementId } = settlementActionSchema.parse(req.body);
    send(res, await noteService.approveSettlement(id, settlementId, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/settlements/post", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { settlementId } = settlementActionSchema.parse(req.body);
    send(res, await noteService.postSettlement(id, settlementId, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/late-charge/calculate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    lateChargeSchema.parse(req.body);
    send(res, await noteService.calculateLateCharge(req.body));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/late-charge/check-overdue", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = overdueLateChargeSchema.parse(req.body);
    send(res, await noteService.applyOverdueLateCharge(id, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/late-charge/approve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const input = lateChargeSchema.parse(req.body);
    send(res, await noteService.approveLateCharge(id, input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/arrears/generate-letter", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.generateNoteLetter(id, "arrears", getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/default/generate-letter", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.generateNoteLetter(id, "default", getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

adminNotesRouter.post("/:id/default/mark", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { reason } = defaultMarkSchema.parse(req.body);
    send(res, await noteService.markDefault(id, reason, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

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
    send(res, await noteService.listInvestorInvestments(getActor(req, res, "INVESTOR").userId));
  } catch (error) {
    next(error);
  }
});

investorNotesRouter.get("/portfolio", async (req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await noteService.getInvestorPortfolio(getActor(req, res, "INVESTOR").userId));
  } catch (error) {
    next(error);
  }
});

investorNotesRouter.post("/balance/test-topup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (process.env.INVESTOR_BALANCE_TEST_TOPUP_ENABLED !== "true") {
      throw new AppError(403, "TEST_TOPUP_DISABLED", "Investor balance test top-up is not enabled");
    }
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
platformFinanceSettingsRouter.get("/", async (_req: Request, res: Response, next: NextFunction) => {
  try {
    send(res, await noteService.getPlatformFinanceSettings());
  } catch (error) {
    next(error);
  }
});
platformFinanceSettingsRouter.patch("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updatePlatformFinanceSettingsSchema.parse(req.body);
    send(res, await noteService.updatePlatformFinanceSettings(input, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

export const withdrawalsRouter = Router();
withdrawalsRouter.use(requireRole(UserRole.ADMIN));
withdrawalsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createWithdrawalSchema.parse(req.body);
    send(res, await noteService.createWithdrawal(input, getActor(req, res, "ADMIN")), 201);
  } catch (error) {
    next(error);
  }
});
withdrawalsRouter.post("/:id/generate-letter", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.generateWithdrawalLetter(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});
withdrawalsRouter.post("/:id/mark-submitted-to-trustee", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    send(res, await noteService.markWithdrawalSubmitted(id, getActor(req, res, "ADMIN")));
  } catch (error) {
    next(error);
  }
});

