/**
 * HTTP layer for signing envelopes.
 */
import { Request, Response, NextFunction, Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission } from "../../lib/auth/middleware";
import { externalSigningRateLimiter } from "../../lib/http/rate-limit";
import { AppError } from "../../lib/http/error-handler";
import { signingService } from "./service";
import { ActivityPortal } from "../applications/logs/types";
import {
  createIssuerEnvelopeSchema,
  voidEnvelopeSchema,
  startExternalSigningSchema,
  confirmExternalSignedSchema,
  verifyExternalAccessCodeSchema,
  recipientEkycSessionSchema,
} from "./schemas";

const signedDocumentParamsSchema = z.object({
  applicationId: z.string().cuid(),
  documentId: z.string().cuid(),
});

const signedDocumentQuerySchema = z.object({
  disposition: z.enum(["inline", "attachment"]).default("inline"),
});

function getUserId(req: Request): string {
  if (!req.user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }
  return req.user.user_id;
}

function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({
    success: true,
    data,
    correlationId: res.locals.correlationId || "unknown",
  });
}

async function createIssuerEnvelope(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createIssuerEnvelopeSchema.parse(req.body);
    const envelope = await signingService.createIssuerEnvelope({
      applicationId: req.params.applicationId,
      title: body.title,
      contractId: body.contractId ?? null,
      invoiceId: body.invoiceId ?? null,
      bindings: body.bindings,
      userId: getUserId(req),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });
    ok(res, envelope, 201);
  } catch (e) {
    next(e);
  }
}

async function sendEnvelope(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await signingService.sendEnvelopeForIssuer(req.params.id, getUserId(req)));
  } catch (e) {
    next(e);
  }
}

async function voidEnvelope(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = voidEnvelopeSchema.parse(req.body ?? {});
    ok(
      res,
      await signingService.voidEnvelope(req.params.id, reason ?? null, {
        userId: getUserId(req),
        portal: ActivityPortal.ADMIN,
      })
    );
  } catch (e) {
    next(e);
  }
}

async function remindRecipient(req: Request, res: Response, next: NextFunction) {
  try {
    await signingService.remindRecipient(req.params.id, req.params.recipientId);
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
}

async function remindRecipientForIssuer(req: Request, res: Response, next: NextFunction) {
  try {
    await signingService.remindRecipientForIssuer(
      req.params.id,
      req.params.recipientId,
      getUserId(req)
    );
    ok(res, { ok: true });
  } catch (e) {
    next(e);
  }
}

async function getEnvelope(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await signingService.getEnvelopeForIssuer(req.params.id, getUserId(req)));
  } catch (e) {
    next(e);
  }
}

async function getApplicationProductWorkflow(req: Request, res: Response, next: NextFunction) {
  try {
    ok(
      res,
      await signingService.getProductWorkflowForIssuerApplication(
        req.params.applicationId,
        getUserId(req)
      )
    );
  } catch (e) {
    next(e);
  }
}

async function listEnvelopes(req: Request, res: Response, next: NextFunction) {
  try {
    ok(
      res,
      await signingService.listEnvelopesForApplicationForIssuer(
        req.params.applicationId,
        getUserId(req)
      )
    );
  } catch (e) {
    next(e);
  }
}

async function getExternalEnvelope(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await signingService.getEnvelopeForExternalToken(req.params.accessToken));
  } catch (e) {
    next(e);
  }
}

async function verifyExternalAccessCode(req: Request, res: Response, next: NextFunction) {
  try {
    const body = verifyExternalAccessCodeSchema.parse(req.body);
    ok(
      res,
      await signingService.verifyExternalAccessCode(req.params.accessToken, body.ic_number)
    );
  } catch (e) {
    next(e);
  }
}

async function resetExternalAccessGate(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await signingService.resetExternalAccessGate(req.params.accessToken));
  } catch (e) {
    next(e);
  }
}

async function createExternalEkycSession(req: Request, res: Response, next: NextFunction) {
  try {
    const body = recipientEkycSessionSchema.parse(req.body ?? {});
    ok(
      res,
      await signingService.createRecipientEkycSession({
        accessToken: req.params.accessToken,
        confirmedName: body.confirmedName,
        force: body.force,
      })
    );
  } catch (e) {
    next(e);
  }
}

async function startExternalSigning(req: Request, res: Response, next: NextFunction) {
  try {
    const body = startExternalSigningSchema.parse(req.body);
    ok(
      res,
      await signingService.startRecipientSigningForExternalToken({
        accessToken: req.params.accessToken,
        documentId: body.documentId,
      })
    );
  } catch (e) {
    next(e);
  }
}

async function confirmSigningReturn(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await signingService.confirmRecipientSignedForReturnSession(req.params.returnSessionId));
  } catch (e) {
    next(e);
  }
}

async function confirmExternalSigned(req: Request, res: Response, next: NextFunction) {
  try {
    const body = confirmExternalSignedSchema.parse(req.body);
    ok(
      res,
      await signingService.confirmRecipientSignedForExternalToken({
        accessToken: req.params.accessToken,
        documentId: body.documentId,
      })
    );
  } catch (e) {
    next(e);
  }
}

async function syncExternalFromProvider(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await signingService.syncEnvelopeFromProviderForExternalToken(req.params.accessToken));
  } catch (e) {
    next(e);
  }
}

async function syncEnvelopeFromProvider(req: Request, res: Response, next: NextFunction) {
  try {
    ok(
      res,
      await signingService.syncEnvelopeFromProviderForIssuer(req.params.id, getUserId(req))
    );
  } catch (e) {
    next(e);
  }
}

async function sendSignedDocument(
  res: Response,
  buffer: Buffer,
  filename: string,
  disposition: "inline" | "attachment"
): Promise<void> {
  const safeFilename = filename.replace(/"/g, "");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${disposition}; filename="${safeFilename}"`
  );
  res.send(buffer);
}

async function getAdminSignedDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { applicationId, documentId } = signedDocumentParamsSchema.parse(req.params);
    const { disposition } = signedDocumentQuerySchema.parse(req.query);
    const { buffer, filename } = await signingService.getSignedDocumentBuffer({
      applicationId,
      documentId,
      asAdmin: true,
    });
    await sendSignedDocument(res, buffer, filename, disposition);
  } catch (e) {
    next(e);
  }
}

async function getIssuerSignedDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const { applicationId, documentId } = signedDocumentParamsSchema.parse(req.params);
    const { disposition } = signedDocumentQuerySchema.parse(req.query);
    const { buffer, filename } = await signingService.getSignedDocumentBuffer({
      applicationId,
      documentId,
      userId: getUserId(req),
      asAdmin: false,
    });
    await sendSignedDocument(res, buffer, filename, disposition);
  } catch (e) {
    next(e);
  }
}

export function createSigningAdminRouter(): Router {
  const router = Router();
  router.post("/envelopes/:id/void", voidEnvelope);
  router.post("/envelopes/:id/recipients/:recipientId/remind", remindRecipient);
  router.get("/envelopes/:id", async (req, res, next) => {
    try {
      ok(res, await signingService.getEnvelope(req.params.id));
    } catch (e) {
      next(e);
    }
  });
  router.get("/applications/:applicationId/envelopes", async (req, res, next) => {
    try {
      ok(res, await signingService.listEnvelopesForApplication(req.params.applicationId));
    } catch (e) {
      next(e);
    }
  });
  router.get(
    "/applications/:applicationId/documents/:documentId/signed",
    requirePermission("applications.view"),
    getAdminSignedDocument
  );
  return router;
}

export function createSigningRouter(): Router {
  const router = Router();
  router.use("/external", externalSigningRateLimiter);
  router.get("/external/:accessToken", getExternalEnvelope);
  router.post("/external/:accessToken/verify", verifyExternalAccessCode);
  router.post("/external/:accessToken/reset-access", resetExternalAccessGate);
  router.post("/external/:accessToken/ekyc/session", createExternalEkycSession);
  router.post("/external/:accessToken/start-signing", startExternalSigning);
  router.post("/external/:accessToken/confirm-signed", confirmExternalSigned);
  router.post("/external/:accessToken/sync-from-provider", syncExternalFromProvider);
  router.post("/return/:returnSessionId/confirm", externalSigningRateLimiter, confirmSigningReturn);
  router.post("/applications/:applicationId/envelopes", requireAuth, createIssuerEnvelope);
  router.get(
    "/applications/:applicationId/product-workflow",
    requireAuth,
    getApplicationProductWorkflow
  );
  router.get("/envelopes/:id", requireAuth, getEnvelope);
  router.get("/applications/:applicationId/envelopes", requireAuth, listEnvelopes);
  router.post("/envelopes/:id/send", requireAuth, sendEnvelope);
  router.post("/envelopes/:id/sync-from-provider", requireAuth, syncEnvelopeFromProvider);
  router.post(
    "/envelopes/:id/recipients/:recipientId/remind",
    requireAuth,
    remindRecipientForIssuer
  );
  router.get(
    "/applications/:applicationId/documents/:documentId/signed",
    requireAuth,
    getIssuerSignedDocument
  );
  return router;
}
