import { Router, Request, Response, NextFunction } from "express";
import { requirePermission } from "../../lib/auth/middleware";
import {
  operatorAdvisorSchema,
  operatorFinancialStatementSchema,
  operatorInterestSchema,
  operatorOfficerSchema,
  operatorProfilePatchSchema,
  operatorShareCapitalPatchSchema,
  operatorShareholderSchema,
} from "../organization-profile/schemas";
import * as operatorProfile from "./service";

export function createOperatorProfileRouter() {
  const router = Router();
  router.use(requirePermission("platform_settings.view"));

  router.get("/", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await operatorProfile.getOrCreateOperatorProfile();
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/", requirePermission("platform_settings.manage"), async (req, res, next) => {
    try {
      const input = operatorProfilePatchSchema.parse(req.body);
      const data = await operatorProfile.patchOperatorProfile(input);
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/share-capital",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = operatorShareCapitalPatchSchema.parse(req.body);
        const data = await operatorProfile.upsertShareCapital(input);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/shareholders",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = operatorShareholderSchema.parse(req.body);
        const data = await operatorProfile.createShareholder(input);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );
  router.patch(
    "/shareholders/:id",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = operatorShareholderSchema.parse(req.body);
        const data = await operatorProfile.updateShareholder(req.params.id, input);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );
  router.delete(
    "/shareholders/:id",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const data = await operatorProfile.deleteShareholder(req.params.id);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post("/officers", requirePermission("platform_settings.manage"), async (req, res, next) => {
    try {
      const input = operatorOfficerSchema.parse(req.body);
      const data = await operatorProfile.createOfficer(input);
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });
  router.patch(
    "/officers/:id",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = operatorOfficerSchema.parse(req.body);
        const data = await operatorProfile.updateOfficer(req.params.id, input);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );
  router.delete(
    "/officers/:id",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const data = await operatorProfile.deleteOfficer(req.params.id);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post("/advisors", requirePermission("platform_settings.manage"), async (req, res, next) => {
    try {
      const input = operatorAdvisorSchema.parse(req.body);
      const data = await operatorProfile.createAdvisor(input);
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });
  router.patch(
    "/advisors/:id",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = operatorAdvisorSchema.parse(req.body);
        const data = await operatorProfile.updateAdvisor(req.params.id, input);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );
  router.delete(
    "/advisors/:id",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const data = await operatorProfile.deleteAdvisor(req.params.id);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post("/interests", requirePermission("platform_settings.manage"), async (req, res, next) => {
    try {
      const input = operatorInterestSchema.parse(req.body);
      const data = await operatorProfile.createInterest(input);
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });
  router.patch(
    "/interests/:id",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = operatorInterestSchema.parse(req.body);
        const data = await operatorProfile.updateInterest(req.params.id, input);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );
  router.delete(
    "/interests/:id",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const data = await operatorProfile.deleteInterest(req.params.id);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/financial-statements",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = operatorFinancialStatementSchema.parse(req.body);
        const data = await operatorProfile.createFinancialStatement(input);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );
  router.patch(
    "/financial-statements/:id",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = operatorFinancialStatementSchema.parse(req.body);
        const data = await operatorProfile.updateFinancialStatement(req.params.id, input);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );
  router.delete(
    "/financial-statements/:id",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const data = await operatorProfile.deleteFinancialStatement(req.params.id);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
