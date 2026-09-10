import { Router, Request, Response, NextFunction } from "express";
import { requirePermission } from "../../lib/auth/middleware";
import {
  operatorAdvisorSchema,
  operatorCompanyStampPatchSchema,
  operatorFinancialStatementSchema,
  operatorInterestSchema,
  operatorOfficerSchema,
  operatorProfilePatchSchema,
  operatorShareCapitalPatchSchema,
  operatorShareholderSchema,
  operatorSigningPersonCreateSchema,
  operatorSigningPersonUpdateSchema,
  parseOperatorBody,
  requestOperatorSigningImageUploadUrlSchema,
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
      const input = parseOperatorBody(operatorProfilePatchSchema, req.body);
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
        const input = parseOperatorBody(operatorShareCapitalPatchSchema, req.body);
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
        const input = parseOperatorBody(operatorShareholderSchema, req.body);
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
        const input = parseOperatorBody(operatorShareholderSchema, req.body);
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
      const input = parseOperatorBody(operatorOfficerSchema, req.body);
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
        const input = parseOperatorBody(operatorOfficerSchema, req.body);
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

  router.post(
    "/signing-people/signature-upload-url",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = requestOperatorSigningImageUploadUrlSchema.parse(req.body);
        const data = await operatorProfile.requestOperatorSigningImageUploadUrl({
          ...input,
          kind: "signature",
        });
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/company-stamp/upload-url",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = requestOperatorSigningImageUploadUrlSchema.parse(req.body);
        const data = await operatorProfile.requestOperatorSigningImageUploadUrl({
          ...input,
          kind: "company_stamp",
        });
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    "/company-stamp",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = parseOperatorBody(operatorCompanyStampPatchSchema, req.body);
        const data = await operatorProfile.patchOperatorCompanyStamp(input);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/signing-people",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = parseOperatorBody(operatorSigningPersonCreateSchema, req.body);
        const data = await operatorProfile.createSigningPerson(input);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    "/signing-people/:id",
    requirePermission("platform_settings.manage"),
    async (req, res, next) => {
      try {
        const input = parseOperatorBody(operatorSigningPersonUpdateSchema, req.body);
        const data = await operatorProfile.updateSigningPerson(req.params.id, input);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post("/advisors", requirePermission("platform_settings.manage"), async (req, res, next) => {
    try {
      const input = parseOperatorBody(operatorAdvisorSchema, req.body);
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
        const input = parseOperatorBody(operatorAdvisorSchema, req.body);
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
      const input = parseOperatorBody(operatorInterestSchema, req.body);
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
        const input = parseOperatorBody(operatorInterestSchema, req.body);
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
        const input = parseOperatorBody(operatorFinancialStatementSchema, req.body);
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
        const input = parseOperatorBody(operatorFinancialStatementSchema, req.body);
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
