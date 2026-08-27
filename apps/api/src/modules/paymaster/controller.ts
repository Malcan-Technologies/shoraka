import { NextFunction, Request, Response, Router } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireAuth, requirePermission, requireRole } from "../../lib/auth/middleware";
import { auditContextFromRequest } from "../../lib/audit";
import { AppError } from "../../lib/http/error-handler";
import { OrganizationRepository } from "../organization/repository";
import {
  assignmentNoticeUploadUrlSchema,
  listPaymastersQuerySchema,
  marcAssessmentSchema,
  marcUploadUrlSchema,
  paymasterIdParamSchema,
  resolveMismatchSchema,
} from "./schemas";
import {
  createMarcAssessment,
  getAdminPaymasterDetail,
  getCurrentMarcAssessment,
  listAdminPaymasters,
  listIssuerPaymasters,
  requestIssuerMarcReportUploadUrl,
  resolvePaymasterMismatch,
} from "./service";
import {
  attachAssignmentNoticeFile,
  confirmAssignmentNoticeAcknowledgement,
  generateNoteAssignmentNotice,
  getAssignmentNoticeDownloadUrl,
  getNoteAssignmentNotice,
  markNoteAssignmentNoticeSent,
  requestAssignmentNoticeUploadUrl,
} from "./assignment-notice.service";

const organizationRepository = new OrganizationRepository();

function getUserId(req: Request): string {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }
  return req.user.user_id;
}

function send(res: Response, data: unknown, status = 200) {
  res.status(status).json({
    success: true,
    data,
    correlationId: res.locals.correlationId || "unknown",
  });
}

export function createIssuerPaymasterRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const organizationId =
        typeof req.query.organizationId === "string" ? req.query.organizationId : "";
      if (!organizationId) {
        throw new AppError(400, "VALIDATION_ERROR", "organizationId is required");
      }
      const userId = getUserId(req);
      const member = await organizationRepository.getOrganizationMember(
        organizationId,
        userId,
        "issuer"
      );
      const organization = await organizationRepository.findIssuerOrganizationById(organizationId);
      if (!member && organization?.owner_user_id !== userId) {
        throw new AppError(403, "FORBIDDEN", "You do not have access to this organisation.");
      }
      send(res, { paymasters: await listIssuerPaymasters(organizationId) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const adminPaymasterRouter = Router();
adminPaymasterRouter.use(requireRole(UserRole.ADMIN));

adminPaymasterRouter.get(
  "/",
  requirePermission("paymasters.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listPaymastersQuerySchema.parse(req.query);
      send(
        res,
        await listAdminPaymasters({
          q: query.q,
          mismatchPending: query.mismatchPending === "true" ? true : undefined,
          page: query.page,
          pageSize: query.pageSize,
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

adminPaymasterRouter.get(
  "/:id",
  requirePermission("paymasters.view"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = paymasterIdParamSchema.parse(req.params);
      send(res, await getAdminPaymasterDetail(id));
    } catch (error) {
      next(error);
    }
  }
);

adminPaymasterRouter.post(
  "/:id/mismatches/:mismatchId/resolve",
  requirePermission("paymasters.manage"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = paymasterIdParamSchema.parse(req.params);
      const mismatchId = String(req.params.mismatchId);
      resolveMismatchSchema.parse(req.body ?? {});
      await resolvePaymasterMismatch({
        paymasterId: id,
        mismatchId,
        actorUserId: getUserId(req),
      });
      send(res, await getAdminPaymasterDetail(id));
    } catch (error) {
      next(error);
    }
  }
);

export async function handleGetIssuerMarc(req: Request, res: Response, next: NextFunction) {
  try {
    const issuerOrganizationId = String(req.params.id);
    send(res, { current: await getCurrentMarcAssessment(issuerOrganizationId) });
  } catch (error) {
    next(error);
  }
}

export async function handleCreateIssuerMarc(req: Request, res: Response, next: NextFunction) {
  try {
    const issuerOrganizationId = String(req.params.id);
    const body = marcAssessmentSchema.parse(req.body);
    send(
      res,
      await createMarcAssessment({
        issuerOrganizationId,
        actorUserId: getUserId(req),
        creditScore: body.creditScore,
        probabilityOfDefault: body.probabilityOfDefault,
        reportDate: body.reportDate,
        reportS3Key: body.reportS3Key,
        reportFileName: body.reportFileName,
        context: auditContextFromRequest(req, { res }),
      }),
      201
    );
  } catch (error) {
    next(error);
  }
}

export async function handleIssuerMarcUploadUrl(req: Request, res: Response, next: NextFunction) {
  try {
    const issuerOrganizationId = String(req.params.id);
    const body = marcUploadUrlSchema.parse(req.body);
    send(
      res,
      await requestIssuerMarcReportUploadUrl({
        issuerOrganizationId,
        fileName: body.fileName,
        contentType: body.contentType,
        fileSize: body.fileSize,
      })
    );
  } catch (error) {
    next(error);
  }
}

const attachSchema = z.object({
  kind: z.enum(["notice", "acknowledgement"]),
  fileName: z.string().min(1),
  s3Key: z.string().min(1),
});

export function registerNoteAssignmentNoticeRoutes(router: Router) {
  router.get(
    "/:id/assignment-notice",
    requirePermission("notes.view"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        send(res, { notice: await getNoteAssignmentNotice(String(req.params.id)) });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/assignment-notice/generate",
    requirePermission("notes.disbursement.manage"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        send(
          res,
          await generateNoteAssignmentNotice(String(req.params.id), {
            userId: getUserId(req),
            role: "ADMIN",
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/assignment-notice/mark-sent",
    requirePermission("notes.disbursement.manage"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        send(
          res,
          await markNoteAssignmentNoticeSent(String(req.params.id), {
            userId: getUserId(req),
            role: "ADMIN",
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/assignment-notice/upload-url",
    requirePermission("notes.disbursement.manage"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = assignmentNoticeUploadUrlSchema.parse(req.body);
        send(
          res,
          await requestAssignmentNoticeUploadUrl({
            noteId: String(req.params.id),
            kind: body.kind,
            fileName: body.fileName,
            contentType: body.contentType,
            fileSize: body.fileSize,
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/assignment-notice/attach",
    requirePermission("notes.disbursement.manage"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = attachSchema.parse(req.body);
        send(
          res,
          await attachAssignmentNoticeFile({
            noteId: String(req.params.id),
            actor: { userId: getUserId(req), role: "ADMIN" },
            kind: body.kind,
            s3Key: body.s3Key,
            fileName: body.fileName,
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/assignment-notice/confirm-acknowledgement",
    requirePermission("notes.disbursement.manage"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        send(
          res,
          await confirmAssignmentNoticeAcknowledgement(String(req.params.id), {
            userId: getUserId(req),
            role: "ADMIN",
          })
        );
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/:id/assignment-notice/download",
    requirePermission("notes.view"),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const kind = req.query.kind === "acknowledgement" ? "acknowledgement" : "notice";
        send(res, await getAssignmentNoticeDownloadUrl({ noteId: String(req.params.id), kind }));
      } catch (error) {
        next(error);
      }
    }
  );
}
