import { Application, Router } from "express";
import * as swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./lib/swagger";
import { authRouter } from "./modules/auth/controller";

export function registerRoutes(app: Application): void {
  // Swagger API documentation
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "CashSouk API Documentation",
    customCss: '.swagger-ui .topbar { display: none }',
  }));

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

  app.use("/v1", v1Router);
}

