/**
 * HTTP layer for signing envelopes.
 *  - Admin router (createSigningAdminRouter): read / void / remind. Mounted under the
 *    ADMIN-gated block.
 *  - Authed router (createSigningRouter): issuer create / send / read / sign-my-part.
 * Controllers only validate and orchestrate; all logic lives in the service.
 */
import { Request, Response, NextFunction, Router } from "express";
import { requireAuth } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { signingService } from "./service";
import {
  createIssuerEnvelopeSchema,
  voidEnvelopeSchema,
  startExternalSigningSchema,
  startSigningSchema,
} from "./schemas";

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
    ok(res, await signingService.voidEnvelope(req.params.id, reason ?? null));
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

async function getEnvelope(req: Request, res: Response, next: NextFunction) {
  try {
    ok(res, await signingService.getEnvelopeForIssuer(req.params.id, getUserId(req)));
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

async function startSigning(req: Request, res: Response, next: NextFunction) {
  try {
    const body = startSigningSchema.parse(req.body);
    const result = await signingService.startRecipientSigningForIssuer({
      envelopeId: req.params.id,
      recipientId: body.recipientId,
      documentId: body.documentId,
      userId: getUserId(req),
      redirectUrl: body.redirectUrl ?? null,
    });
    ok(res, result);
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

async function startExternalSigning(req: Request, res: Response, next: NextFunction) {
  try {
    const body = startExternalSigningSchema.parse(req.body);
    ok(
      res,
      await signingService.startRecipientSigningForExternalToken({
        accessToken: req.params.accessToken,
        documentId: body.documentId,
        redirectUrl: body.redirectUrl ?? null,
      })
    );
  } catch (e) {
    next(e);
  }
}

/** Admin-only lifecycle routes (mount under an ADMIN-gated path). */
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
  return router;
}

/** Authenticated issuer routes: read envelope + sign my part. */
export function createSigningRouter(): Router {
  const router = Router();
  router.get("/external/:accessToken", getExternalEnvelope);
  router.post("/external/:accessToken/start-signing", startExternalSigning);
  router.post("/applications/:applicationId/envelopes", requireAuth, createIssuerEnvelope);
  router.get("/envelopes/:id", requireAuth, getEnvelope);
  router.get("/applications/:applicationId/envelopes", requireAuth, listEnvelopes);
  router.post("/envelopes/:id/send", requireAuth, sendEnvelope);
  router.post("/envelopes/:id/start-signing", requireAuth, startSigning);
  return router;
}
