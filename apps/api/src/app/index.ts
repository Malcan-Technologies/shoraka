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
import { portalContextMiddleware } from "./middleware/portal-context";
import { registerRoutes } from "../routes";
import { createSessionMiddleware } from "./session";
import { initializeOpenIdClient } from "../lib/openid-client";
import { hydrateVerifier } from "../lib/auth/cognito-jwt-verifier";
import { regTankWebhookRouter } from "../modules/regtank/webhook-controller";

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

  // Register webhook routes BEFORE express.json() so we can capture raw body for signature verification
  app.use("/v1/webhooks", regTankWebhookRouter);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser()); // Parse HTTP-Only cookies

  /**
   * @swagger
   * /healthz:
   *   get:
   *     summary: Liveness probe
   *     description: |
   *       Lightweight liveness check used by ALB / Docker HEALTHCHECK.
   *       Always returns 200 as long as the process is running and can
   *       serve HTTP. Does NOT query the database — a transient DB blip
   *       must not cause ECS to kill the task.
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Process is alive
   */
  app.get("/healthz", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * @swagger
   * /readyz:
   *   get:
   *     summary: Readiness / deep health check
   *     description: |
   *       Tests database connectivity. Use for dashboards, monitoring
   *       alarms, and pre-deploy gating — NOT for ALB target-group or
   *       Docker HEALTHCHECK (those should use /healthz).
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is fully ready
   *       503:
   *         description: Database is unreachable
   */
  app.get("/readyz", async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1 as health_check`;
      res.json({
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, "Readiness check failed — database unreachable");
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
  app.use(portalContextMiddleware);

  // Initialize OpenID client for OAuth flows
  await initializeOpenIdClient();

  // Hydrate JWT verifier with JWKS to reduce latency on first request
  await hydrateVerifier();

  app.use(
    pinoHttp({
      logger,
      customLogLevel: (_req, res, err) => {
        if (res.statusCode >= 500 || err) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.headers['set-cookie']",
          "req.headers['x-api-key']",
          "res.headers['set-cookie']",
        ],
        remove: true,
      },
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
            query: req.query,
            remoteAddress: req.remoteAddress,
            remotePort: req.remotePort,
          };
        },
      },
    })
  );

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
