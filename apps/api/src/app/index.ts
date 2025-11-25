import express, { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import { pinoHttp } from "pino-http";
import { logger } from "../lib/logger";
import { errorHandler } from "../lib/http/error-handler";
import { notFoundHandler } from "../lib/http/not-found";
import { correlationIdMiddleware } from "./middleware/cors";
import { registerRoutes } from "../routes";

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"];
  
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        if (origin.endsWith(".ecs.ap-southeast-5.on.aws")) {
          logger.info({ origin }, "Allowing ECS origin");
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

  app.use(correlationIdMiddleware);

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

  app.get("/healthz", async (_, res) => {
    try {
      // Test database connection
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1 as health_check`;
      await prisma.$disconnect();
      
      res.json({ 
        status: "ok", 
        database: "connected",
        timestamp: new Date().toISOString() 
      });
    } catch (error) {
      logger.error({ error }, "Health check failed");
      res.status(503).json({ 
        status: "error", 
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString() 
      });
    }
  });

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
