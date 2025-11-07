import { Application, Router } from "express";

export function registerRoutes(app: Application): void {
  const v1Router = Router();

  v1Router.get("/", (_req, res) => {
    res.json({
      success: true,
      data: {
        message: "Shoraka P2P Lending API v1",
        version: "1.0.0",
      },
      correlationId: res.locals.correlationId || "unknown",
    });
  });

  app.use("/v1", v1Router);
}

