import { Application, Router } from "express";
import * as swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./lib/swagger";
import { authRouter } from "./modules/auth/controller";
import cognitoAuthRouter from "./modules/auth/cognito.routes";
import { adminRouter } from "./modules/admin/controller";
import { requireAuth, requireRole } from "./lib/auth/middleware";
import { devAuthBypass } from "./lib/auth/dev-auth-middleware";
import { UserRole } from "@prisma/client";
import { logger } from "./lib/logger";

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
  
  // Admin routes - use dev bypass if DISABLE_AUTH=true, otherwise use real auth
  if (process.env.DISABLE_AUTH === "true" && process.env.NODE_ENV !== "production") {
    logger.warn("🔓 DEVELOPMENT MODE: Admin routes using authentication bypass");
    v1Router.use("/admin", devAuthBypass, requireRole(UserRole.ADMIN), adminRouter);
  } else {
    v1Router.use("/admin", requireAuth, requireRole(UserRole.ADMIN), adminRouter);
  }

  app.use("/v1", v1Router);
}
