import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, requirePermission } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { OrganizationService } from "../organization/service";
import {
  adoptObservedParty,
  assertIssuerProfileCompleteForSubmit,
  computeOrgProfileCompleteness,
  createUserAddedParty,
  deleteManagementParty,
  inactivateMasterParty,
  listPartyProfiles,
  patchIssuerOrgFinancials,
  patchOrgMasterProfile,
  patchPartyProfile,
  resolvePartyMismatch,
  seedMasterPartiesIfEmpty,
} from "./service";
import {
  financialYearPatchSchema,
  mismatchResolveSchema,
  orgMasterPatchSchema,
  partyPatchSchema,
  createPartySchema,
  portalParamSchema,
} from "./schemas";
import { createSecurityLogRow } from "../../lib/audit/account-logs";
import { AUDIT_PORTAL, AUDIT_TARGET_TYPE } from "../../lib/audit/context";

const organizationService = new OrganizationService();

async function logMasterProfileAudit(params: {
  req: Request;
  organizationId: string;
  eventType: string;
  metadata: Record<string, unknown>;
}) {
  const userId = params.req.user?.user_id;
  if (!userId) return;
  await createSecurityLogRow({
    userId,
    eventType: params.eventType,
    portal: "ADMIN",
    targetType: AUDIT_TARGET_TYPE.ORGANIZATION,
    targetId: params.organizationId,
    correlationId: typeof params.req.headers["x-correlation-id"] === "string"
      ? params.req.headers["x-correlation-id"]
      : null,
    metadata: params.metadata,
  });
}

async function assertOrgAccess(req: Request, portal: "issuer" | "investor", organizationId: string) {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  await organizationService.getOrganization(req.user.user_id, organizationId, portal);
  return req.user.user_id;
}

function portalFromParams(req: Request): "issuer" | "investor" {
  return portalParamSchema.parse(req.params.portal);
}

export function createOrganizationProfileRouter() {
  const router = Router();

  router.get(
    "/:portal/:id/profile-completeness",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const portal = portalFromParams(req);
        const { id } = req.params;
        await assertOrgAccess(req, portal, id);
        const data = await computeOrgProfileCompleteness(portal, id);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/:portal/:id/party-profiles",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const portal = portalFromParams(req);
        const { id } = req.params;
        await assertOrgAccess(req, portal, id);
        await seedMasterPartiesIfEmpty(portal, id);
        const data = await listPartyProfiles(portal, id);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    "/:portal/:id/master-profile",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const portal = portalFromParams(req);
        const { id } = req.params;
        const userId = await assertOrgAccess(req, portal, id);
        const patch = orgMasterPatchSchema.parse(req.body);
        await patchOrgMasterProfile({
          portal,
          organizationId: id,
          actorUserId: userId,
          source: "USER",
          patch,
          fillEmptyOnly: true,
        });
        const completeness = await computeOrgProfileCompleteness(portal, id);
        res.json({ success: true, data: { completeness }, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    "/:portal/:id/party-profiles/:partyId",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const portal = portalFromParams(req);
        const { id, partyId } = req.params;
        await assertOrgAccess(req, portal, id);
        const patch = partyPatchSchema.parse(req.body);
        const data = await patchPartyProfile({
          portal,
          organizationId: id,
          partyId,
          source: "USER",
          patch,
          fillEmptyOnly: true,
        });
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:portal/:id/party-profiles",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const portal = portalFromParams(req);
        const { id } = req.params;
        await assertOrgAccess(req, portal, id);
        const patch = createPartySchema.parse(req.body);
        const data = await createUserAddedParty({
          portal,
          organizationId: id,
          patch,
          source: "USER",
        });
        await createSecurityLogRow({
          userId: req.user!.user_id,
          eventType: "MASTER_PARTY_CREATED",
          portal: portal === "issuer" ? AUDIT_PORTAL.ISSUER : AUDIT_PORTAL.INVESTOR,
          targetType: AUDIT_TARGET_TYPE.ORGANIZATION,
          targetId: id,
          correlationId: typeof req.headers["x-correlation-id"] === "string"
            ? req.headers["x-correlation-id"]
            : null,
          metadata: { portal, partyId: data.id, partyKey: data.partyKey, origin: data.origin },
        });
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.delete(
    "/:portal/:id/party-profiles/:partyId",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const portal = portalFromParams(req);
        const { id, partyId } = req.params;
        await assertOrgAccess(req, portal, id);
        await deleteManagementParty({ portal, organizationId: id, partyId });
        res.json({ success: true, data: { success: true }, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    "/issuer/:id/financials",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        await assertOrgAccess(req, "issuer", id);
        const body = financialYearPatchSchema.parse(req.body);
        await patchIssuerOrgFinancials({ organizationId: id, year: body.year, fields: body.fields });
        const completeness = await computeOrgProfileCompleteness("issuer", id);
        res.json({ success: true, data: { completeness }, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export function createAdminOrganizationProfileRouter() {
  const router = Router();
  router.use(requirePermission("organizations.view"));

  router.get("/:portal/:id/profile-completeness", async (req, res, next) => {
    try {
      const portal = portalFromParams(req);
      const data = await computeOrgProfileCompleteness(portal, req.params.id);
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:portal/:id/party-profiles", async (req, res, next) => {
    try {
      const portal = portalFromParams(req);
      const data = await listPartyProfiles(portal, req.params.id);
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:portal/:id/master-profile", requirePermission("organizations.manage"), async (req, res, next) => {
    try {
      if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
      const portal = portalFromParams(req);
      const patch = orgMasterPatchSchema.parse(req.body);
      await patchOrgMasterProfile({
        portal,
        organizationId: req.params.id,
        actorUserId: req.user.user_id,
        source: "ADMIN",
        patch,
      });
      await logMasterProfileAudit({
        req,
        organizationId: req.params.id,
        eventType: "MASTER_PROFILE_UPDATED",
        metadata: { portal, fields: Object.keys(patch) },
      });
      const completeness = await computeOrgProfileCompleteness(portal, req.params.id);
      res.json({ success: true, data: { completeness }, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:portal/:id/party-profiles/:partyId", requirePermission("organizations.manage"), async (req, res, next) => {
    try {
      const portal = portalFromParams(req);
      const patch = partyPatchSchema.parse(req.body);
      const data = await patchPartyProfile({
        portal,
        organizationId: req.params.id,
        partyId: req.params.partyId,
        source: "ADMIN",
        patch,
      });
      await logMasterProfileAudit({
        req,
        organizationId: req.params.id,
        eventType: "MASTER_PARTY_UPDATED",
        metadata: { portal, partyId: req.params.partyId, fields: Object.keys(patch) },
      });
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:portal/:id/party-profiles/:partyId/resolve-mismatch", requirePermission("organizations.manage"), async (req, res, next) => {
    try {
      const portal = portalFromParams(req);
      const input = mismatchResolveSchema.parse(req.body);
      const data = await resolvePartyMismatch({
        portal,
        organizationId: req.params.id,
        partyId: req.params.partyId,
        input,
      });
      await logMasterProfileAudit({
        req,
        organizationId: req.params.id,
        eventType: "MASTER_PARTY_MISMATCH_RESOLVED",
        metadata: { portal, partyId: req.params.partyId, action: input.action, field: input.field },
      });
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:portal/:id/party-profiles/:partyId/adopt", requirePermission("organizations.manage"), async (req, res, next) => {
    try {
      const portal = portalFromParams(req);
      const data = await adoptObservedParty({
        portal,
        organizationId: req.params.id,
        partyId: req.params.partyId,
      });
      await logMasterProfileAudit({
        req,
        organizationId: req.params.id,
        eventType: "MASTER_PARTY_ADOPTED",
        metadata: { portal, partyId: req.params.partyId },
      });
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:portal/:id/party-profiles/:partyId/inactivate", requirePermission("organizations.manage"), async (req, res, next) => {
    try {
      const portal = portalFromParams(req);
      const data = await inactivateMasterParty({
        portal,
        organizationId: req.params.id,
        partyId: req.params.partyId,
      });
      await logMasterProfileAudit({
        req,
        organizationId: req.params.id,
        eventType: "MASTER_PARTY_INACTIVATED",
        metadata: { portal, partyId: req.params.partyId },
      });
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:portal/:id/party-profiles", requirePermission("organizations.manage"), async (req, res, next) => {
    try {
      const portal = portalFromParams(req);
      const patch = createPartySchema.parse(req.body);
      const data = await createUserAddedParty({
        portal,
        organizationId: req.params.id,
        patch,
        source: "ADMIN",
      });
      await logMasterProfileAudit({
        req,
        organizationId: req.params.id,
        eventType: "MASTER_PARTY_CREATED",
        metadata: { portal, partyId: data.id, partyKey: data.partyKey },
      });
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export { assertIssuerProfileCompleteForSubmit };
