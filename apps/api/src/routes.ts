import { Application, Router } from "express";
import * as swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./lib/swagger";
import { authRouter } from "./modules/auth/controller";
import cognitoAuthRouter from "./modules/auth/cognito.routes";
import { adminRouter } from "./modules/admin/controller";
import { createOrganizationRouter } from "./modules/organization/controller";
import { regTankRouter } from "./modules/regtank/controller";
import { regTankAdminRouter } from "./modules/regtank/admin-controller";
import { legalDocumentAdminRouter } from "./modules/legal-documents/admin-controller";
import { legalDocumentAcceptanceAdminRouter } from "./modules/legal-documents/acceptance-admin-controller";
import { legalExternalAcceptanceAdminRouter } from "./modules/legal-documents/external-acceptance-admin-controller";
import { legalDocumentAuditAdminRouter } from "./modules/legal-documents/audit-admin-controller";
import { legalDocumentUserRouter } from "./modules/legal-documents/user-controller";
import { legalDocumentPublicRouter } from "./modules/legal-documents/public-controller";
import { productLogRouter } from "./modules/products/log/controller";
import { productsRouter } from "./modules/products/controller";
import { issuerCatalogRouter } from "./modules/products/issuer-catalog-controller";
import { requireAuth, requireRole } from "./lib/auth/middleware";
import { devAuthBypass } from "./lib/auth/dev-auth-middleware";
import { UserRole } from "@prisma/client";
import { logger } from "./lib/logger";
import { createApplicationRouter } from "./modules/applications/controller";
import { createContractRouter } from "./modules/contracts/controller";
import { createInvoiceRouter } from "./modules/invoices/controller";
import { createSigningAdminRouter, createSigningRouter } from "./modules/signing/controller";
import { activityRouter } from "./modules/activity/controller";
import { createS3Router } from "./modules/s3/controller";
import { notificationRouter } from "./modules/notification/controller";
import {
  adminInvestmentsRouter,
  adminNotesRouter,
  investorNotesRouter,
  issuerNotesRouter,
  marketplaceRouter,
  platformFinanceSettingsRouter,
  publicMarketplaceRouter,
  withdrawalsRouter,
} from "./modules/notes/controller";
import { issuerDashboardRouter } from "./modules/issuer-dashboard/controller";
import {
  adminPaymasterRouter,
  createIssuerPaymasterRouter,
} from "./modules/paymaster/controller";
import { ekycRouter } from "./modules/ekyc/controller";
import { investorDepositsRouter } from "./modules/payment/deposit-controller";
import { issuerOnboardingFeeRouter } from "./modules/payment/onboarding-fee-controller";
import { applicationProcessingFeeRouter } from "./modules/payment/processing-fee-controller";
import { facilityFeePaymentRouter } from "./modules/payment/facility-fee-controller";
import { excessLateChargePaymentRouter } from "./modules/payment/excess-late-charge-controller";
import { gatewayPaymentsAdminRouter } from "./modules/payment/admin-controller";
import { gatewayReconAdminRouter } from "./modules/payment/recon-controller";
import { facilityLoDemoRouter } from "./modules/applications/letter-of-offer/facility-lo-demo.controller";
import { opsAlertsAdminRouter } from "./modules/ops-alerts/controller";
export function registerRoutes(app: Application): void {
  // Swagger API documentation (only in development)
  if (process.env.NODE_ENV !== "production") {
    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        customSiteTitle: "CashSouk API Documentation",
        customCss: ".swagger-ui .topbar { display: none }",
      })
    );
  }

  // Cognito OAuth routes - also available at /api/auth for backward compatibility
  app.use("/api/auth", cognitoAuthRouter);

  // Note: Webhook routes are registered in app/index.ts BEFORE express.json()
  // to allow raw body capture for signature verification

  const v1Router = Router();

  /**
   * @swagger
   * /v1:
   *   get:
   *     summary: API root endpoint
   *     tags: [General]
   *     responses:
   *       200:
   *         description: API information
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ApiResponse'
   */
  v1Router.get("/", (_req, res) => {
    res.json({
      success: true,
      data: {
        message: "CashSouk P2P Lending API v1",
        version: "1.0.0",
        documentation: "/api-docs",
      },
      correlationId: res.locals.correlationId || "unknown",
    });
  });

  // Register module routes
  v1Router.use("/auth", authRouter);

  // Cognito OAuth routes under v1 (for consistency with versioned API)
  v1Router.use("/auth/cognito", cognitoAuthRouter);

  // Organization routes
  v1Router.use("/organizations", createOrganizationRouter());

  v1Router.use("/applications", createApplicationRouter());
  v1Router.use(
    "/applications/:applicationId/processing-fee",
    requireAuth,
    applicationProcessingFeeRouter
  );
  // Public issuer catalog (active products + live-check); no auth — same JSON shape as before.
  v1Router.use("/issuer/products", issuerCatalogRouter);
  v1Router.use("/contracts", createContractRouter());
  v1Router.use("/contracts/:contractId/facility-fee", requireAuth, facilityFeePaymentRouter);
  v1Router.use(
    "/notes/:noteId/excess-late-charges",
    requireAuth,
    excessLateChargePaymentRouter
  );
  v1Router.use("/invoices", createInvoiceRouter());

  // Multi-party signing envelopes (issuer reads + sign-my-part). Admin lifecycle
  // routes are mounted under the ADMIN-gated block below.
  v1Router.use("/signing", createSigningRouter());

  // Products list (admin only) – GET /v1/products, GET /v1/products/:id
  if (process.env.DISABLE_AUTH === "true" && process.env.NODE_ENV !== "production") {
    v1Router.use("/products", devAuthBypass, requireRole(UserRole.ADMIN), productsRouter);
  } else {
    v1Router.use("/products", requireAuth, requireRole(UserRole.ADMIN), productsRouter);
  }

  // RegTank routes (require authentication)
  v1Router.use("/regtank", requireAuth, regTankRouter);

  // RegTank admin routes (require authentication + ADMIN role)
  v1Router.use("/regtank", requireAuth, regTankAdminRouter);

  // Admin routes - use dev bypass if DISABLE_AUTH=true, otherwise use real auth
  if (process.env.DISABLE_AUTH === "true" && process.env.NODE_ENV !== "production") {
    logger.warn("🔓 DEVELOPMENT MODE: Admin routes using authentication bypass");
    v1Router.use("/admin", devAuthBypass, requireRole(UserRole.ADMIN), adminRouter);
    v1Router.use("/admin/signing", devAuthBypass, requireRole(UserRole.ADMIN), createSigningAdminRouter());
    v1Router.use("/admin/notes", devAuthBypass, adminNotesRouter);
    v1Router.use("/admin/paymasters", devAuthBypass, requireRole(UserRole.ADMIN), adminPaymasterRouter);
    v1Router.use("/admin/investments", devAuthBypass, adminInvestmentsRouter);
    v1Router.use("/admin/platform-finance-settings", devAuthBypass, platformFinanceSettingsRouter);
    v1Router.use("/admin/withdrawals", devAuthBypass, withdrawalsRouter);
    v1Router.use("/admin/gateway-payments", devAuthBypass, gatewayPaymentsAdminRouter);
    v1Router.use("/admin/gateway-recon", devAuthBypass, gatewayReconAdminRouter);
    v1Router.use("/admin/legal-documents", devAuthBypass, requireRole(UserRole.ADMIN), legalDocumentAdminRouter);
    v1Router.use("/admin/legal-document-acceptances", devAuthBypass, requireRole(UserRole.ADMIN), legalDocumentAcceptanceAdminRouter);
    v1Router.use("/admin/legal-external-acceptances", devAuthBypass, requireRole(UserRole.ADMIN), legalExternalAcceptanceAdminRouter);
    v1Router.use("/admin/legal-document-audit-logs", devAuthBypass, requireRole(UserRole.ADMIN), legalDocumentAuditAdminRouter);
    v1Router.use("/admin/product-logs", devAuthBypass, requireRole(UserRole.ADMIN), productLogRouter);
    v1Router.use("/admin/ops-alerts", devAuthBypass, requireRole(UserRole.ADMIN), opsAlertsAdminRouter);
    // DEMO: ARF contract LO merge (wet-ink docx) — not production Send Offer
    v1Router.use(
      "/admin/demos/contract-lo",
      devAuthBypass,
      requireRole(UserRole.ADMIN),
      facilityLoDemoRouter
    );
  } else {
    v1Router.use("/admin", requireAuth, requireRole(UserRole.ADMIN), adminRouter);
    v1Router.use("/admin/signing", requireAuth, requireRole(UserRole.ADMIN), createSigningAdminRouter());
    v1Router.use("/admin/notes", requireAuth, adminNotesRouter);
    v1Router.use("/admin/paymasters", requireAuth, requireRole(UserRole.ADMIN), adminPaymasterRouter);
    v1Router.use("/admin/investments", requireAuth, adminInvestmentsRouter);
    v1Router.use("/admin/platform-finance-settings", requireAuth, platformFinanceSettingsRouter);
    v1Router.use("/admin/withdrawals", requireAuth, withdrawalsRouter);
    v1Router.use("/admin/gateway-payments", requireAuth, gatewayPaymentsAdminRouter);
    v1Router.use("/admin/gateway-recon", requireAuth, gatewayReconAdminRouter);
    v1Router.use("/admin/legal-documents", requireAuth, requireRole(UserRole.ADMIN), legalDocumentAdminRouter);
    v1Router.use("/admin/legal-document-acceptances", requireAuth, requireRole(UserRole.ADMIN), legalDocumentAcceptanceAdminRouter);
    v1Router.use("/admin/legal-external-acceptances", requireAuth, requireRole(UserRole.ADMIN), legalExternalAcceptanceAdminRouter);
    v1Router.use("/admin/legal-document-audit-logs", requireAuth, requireRole(UserRole.ADMIN), legalDocumentAuditAdminRouter);
    v1Router.use("/admin/product-logs", requireAuth, requireRole(UserRole.ADMIN), productLogRouter);
    v1Router.use("/admin/ops-alerts", requireAuth, requireRole(UserRole.ADMIN), opsAlertsAdminRouter);
    v1Router.use(
      "/admin/demos/contract-lo",
      requireAuth,
      requireRole(UserRole.ADMIN),
      facilityLoDemoRouter
    );
  }

  if (process.env.DISABLE_AUTH === "true" && process.env.NODE_ENV !== "production") {
    v1Router.use("/marketplace", devAuthBypass, marketplaceRouter);
    v1Router.use("/investor/deposits", devAuthBypass, investorDepositsRouter);
    v1Router.use("/issuer/onboarding-fee", devAuthBypass, issuerOnboardingFeeRouter);
    v1Router.use("/investor", devAuthBypass, investorNotesRouter);
    v1Router.use("/issuer/dashboard", devAuthBypass, issuerDashboardRouter);
    v1Router.use("/issuer/paymasters", devAuthBypass, createIssuerPaymasterRouter());
    v1Router.use("/issuer", devAuthBypass, issuerNotesRouter);
  } else {
    v1Router.use("/marketplace", requireAuth, marketplaceRouter);
    v1Router.use("/investor/deposits", requireAuth, investorDepositsRouter);
    v1Router.use("/issuer/onboarding-fee", requireAuth, issuerOnboardingFeeRouter);
    v1Router.use("/investor", requireAuth, investorNotesRouter);
    v1Router.use("/issuer/dashboard", requireAuth, issuerDashboardRouter);
    v1Router.use("/issuer/paymasters", createIssuerPaymasterRouter());
    v1Router.use("/issuer", requireAuth, issuerNotesRouter);
  }

  // Public marketplace preview for landing pages (read-only)
  v1Router.use("/public/marketplace", publicMarketplaceRouter);
  v1Router.use("/public/legal-documents", legalDocumentPublicRouter);
  v1Router.use("/ekyc", ekycRouter);

  v1Router.use("/legal-documents", requireAuth, legalDocumentUserRouter);

  // Activity routes
  v1Router.use("/activities", requireAuth, activityRouter);

  // S3 routes
  v1Router.use("/s3", createS3Router());

  // Notification routes
  v1Router.use("/notifications", requireAuth, notificationRouter);

  app.use("/v1", v1Router);
}
