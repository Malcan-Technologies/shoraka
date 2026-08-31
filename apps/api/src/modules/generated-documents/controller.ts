import { Router, Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { generatedDocumentsService } from "./service";
import {
  generatedDocumentFormatQuerySchema,
  generatedDocumentTypeParamSchema,
  generatedDocumentTypesQuerySchema,
} from "./schemas";
import { applicationIdParamSchema } from "../applications/schemas";
import { AppError } from "../../lib/http/error-handler";

function getUserId(req: Request): string {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }
  return req.user.user_id;
}

function isAdmin(req: Request): boolean {
  return Boolean(req.user?.roles?.includes(UserRole.ADMIN));
}

/** GET /v1/admin/generated-document-types */
export function createGeneratedDocumentCatalogRouter(): Router {
  const router = Router();

  router.get("/", (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = generatedDocumentTypesQuerySchema.parse(req.query);
      const data = generatedDocumentsService.listTypes(query.context);
      res.json({
        success: true,
        data,
        correlationId: res.locals.correlationId || "unknown",
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/** GET /v1/applications/:id/generated-documents/:type */
export function createGeneratedDocumentApplicationRouter(): Router {
  const router = Router({ mergeParams: true });

  router.get("/:type", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = applicationIdParamSchema.parse(req.params);
      const { type } = generatedDocumentTypeParamSchema.parse(req.params);
      const { format } = generatedDocumentFormatQuerySchema.parse(req.query);
      const userId = getUserId(req);

      const result = await generatedDocumentsService.generateDocument({
        applicationId: id,
        typeKey: type,
        format,
        userId,
        asAdmin: isAdmin(req),
      });

      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.setHeader("X-Generated-Document-Template-SHA256", result.templateSha256);
      res.setHeader("X-Generated-Document-Output-SHA256", result.outputSha256);
      res.setHeader("X-Generated-Document-Type", result.type.key);
      res.setHeader("X-Generated-Document-Version", String(result.type.version));
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/** GET /v1/admin/applications/:id/generated-documents/:type */
export function createAdminGeneratedDocumentApplicationRouter(): Router {
  const router = Router({ mergeParams: true });

  router.get("/:type", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = applicationIdParamSchema.parse(req.params);
      const { type } = generatedDocumentTypeParamSchema.parse(req.params);
      const { format } = generatedDocumentFormatQuerySchema.parse(req.query);
      const userId = getUserId(req);

      const result = await generatedDocumentsService.generateDocument({
        applicationId: id,
        typeKey: type,
        format,
        userId,
        asAdmin: true,
      });

      res.setHeader("Content-Type", result.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.setHeader("X-Generated-Document-Template-SHA256", result.templateSha256);
      res.setHeader("X-Generated-Document-Output-SHA256", result.outputSha256);
      res.setHeader("X-Generated-Document-Type", result.type.key);
      res.setHeader("X-Generated-Document-Version", String(result.type.version));
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
