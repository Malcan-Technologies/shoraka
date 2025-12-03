import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { errorHandler } from "../lib/http/error-handler";
import { notFoundHandler } from "../lib/http/not-found";
import { correlationIdMiddleware } from "./middleware/cors";
import { registerRoutes } from "../routes";
import { createSessionMiddleware } from "./session";
import { initializeOpenIdClient } from "../lib/openid-client";

export async function createApp(): Promise<Application> {
  const app = express();

  // Helmet security headers
  // Disable CSP for API server - CSP is for HTML pages, not JSON APIs
  // The frontends have their own CSP configurations
  app.use(
    helmet({
      contentSecurityPolicy: false, // API doesn't serve HTML, CSP not needed
    })
  );

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"];

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        logger.warn({ origin, allowedOrigins }, "Origin not allowed");
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser()); // Parse HTTP-Only cookies

  /**
   * @swagger
   * /healthz:
   *   get:
   *     summary: Health check endpoint
   *     description: Check API and database connectivity status
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: ok
   *                 database:
   *                   type: string
   *                   example: connected
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *       503:
   *         description: Service is unhealthy
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: error
   *                 database:
   *                   type: string
   *                   example: disconnected
   *                 error:
   *                   type: string
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   */
  app.get("/healthz", async (_, res) => {
    try {
      // Test database connection using shared Prisma client
      await prisma.$queryRaw`SELECT 1 as health_check`;

      res.json({
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, "Health check failed");
      res.status(503).json({
        status: "error",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Session middleware comes AFTER healthz so health checks are independent
  app.use(await createSessionMiddleware());

  app.use(correlationIdMiddleware);

  await initializeOpenIdClient();

  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
    })
  );

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
