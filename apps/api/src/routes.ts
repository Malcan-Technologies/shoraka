import { Application, Router } from "express";
import * as swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./lib/swagger";
import { authRouter } from "./modules/auth/controller";
import cognitoAuthRouter from "./modules/auth/cognito.routes";
import { adminRouter } from "./modules/admin/controller";
import { createOrganizationRouter } from "./modules/organization/controller";
import { regTankRouter } from "./modules/regtank/controller";
import { regTankAdminRouter } from "./modules/regtank/admin-controller";
import { siteDocumentAdminRouter } from "./modules/site-documents/admin-controller";
import { siteDocumentUserRouter } from "./modules/site-documents/user-controller";
import { documentLogRouter } from "./modules/site-documents/log-controller";
import { productLogRouter } from "./modules/products/log-controller";
import { requireAuth, requireRole } from "./lib/auth/middleware";
import { devAuthBypass } from "./lib/auth/dev-auth-middleware";
import { UserRole } from "@prisma/client";
import { logger } from "./lib/logger";
import { createProductRouter } from "./modules/products/controller";
import { createApplicationRouter } from "./modules/applications/controller";
import { createContractRouter } from "./modules/contracts/controller";
import { createInvoiceRouter } from "./modules/invoices/controller";
import { activityRouter } from "./modules/activity/controller";
import { createS3Router } from "./modules/s3/controller";
import { notificationRouter } from "./modules/notification/controller";

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

  v1Router.use("/products", createProductRouter());

  v1Router.use("/applications", createApplicationRouter());
  v1Router.use("/contracts", createContractRouter());
  v1Router.use("/invoices", createInvoiceRouter());

  // RegTank routes (require authentication)
  v1Router.use("/regtank", requireAuth, regTankRouter);

  // RegTank admin routes (require authentication + ADMIN role)
  v1Router.use("/regtank", requireAuth, regTankAdminRouter);

  // Admin routes - use dev bypass if DISABLE_AUTH=true, otherwise use real auth
  if (process.env.DISABLE_AUTH === "true" && process.env.NODE_ENV !== "production") {
    logger.warn("🔓 DEVELOPMENT MODE: Admin routes using authentication bypass");
    v1Router.use("/admin", devAuthBypass, requireRole(UserRole.ADMIN), adminRouter);
    v1Router.use("/admin/site-documents", devAuthBypass, requireRole(UserRole.ADMIN), siteDocumentAdminRouter);
    v1Router.use("/admin/document-logs", devAuthBypass, requireRole(UserRole.ADMIN), documentLogRouter);
    v1Router.use("/admin/product-logs", devAuthBypass, requireRole(UserRole.ADMIN), productLogRouter);
  } else {
    v1Router.use("/admin", requireAuth, requireRole(UserRole.ADMIN), adminRouter);
    v1Router.use("/admin/site-documents", requireAuth, requireRole(UserRole.ADMIN), siteDocumentAdminRouter);
    v1Router.use("/admin/document-logs", requireAuth, requireRole(UserRole.ADMIN), documentLogRouter);
    v1Router.use("/admin/product-logs", requireAuth, requireRole(UserRole.ADMIN), productLogRouter);
  }

  // Site documents routes (authenticated users)
  v1Router.use("/documents", requireAuth, siteDocumentUserRouter);

  // Activity routes
  v1Router.use("/activities", requireAuth, activityRouter);

  // S3 routes
  v1Router.use("/s3", createS3Router());

  // Notification routes
  v1Router.use("/notifications", requireAuth, notificationRouter);

  app.use("/v1", v1Router);
}
