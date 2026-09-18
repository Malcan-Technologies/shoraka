import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, requirePermission } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { OrganizationService } from "../organization/service";
import { prisma } from "../../lib/prisma";
import {
  adoptObservedParty,
  assertIssuerProfileCompleteForSubmit,
  computeOrgProfileCompleteness,
  createUserAddedParty,
  deleteManagementParty,
  getIssuerFinancialSummary,
  inactivateMasterParty,
  listPartyProfiles,
  acknowledgeCtosAbsence,
  patchIssuerOrgFinancials,
  patchOrgMasterProfile,
  patchPartyProfile,
  reactivateMasterParty,
  resolvePartyMismatch,
  seedMasterPartiesIfEmpty,
} from "./service";
import { refreshPartyRegTankStatus } from "./refresh-party-regtank-status";
import { resolvePersonIdentityConflict } from "./regtank-party-seed";
import {
  financialYearPatchSchema,
  identityConflictResolveSchema,
  mismatchResolveSchema,
  orgMasterPatchSchema,
  partyPatchSchema,
  createPartySchema,
  portalParamSchema,
} from "./schemas";
import { createSecurityLogRow } from "../../lib/audit/account-logs";
import { AUDIT_PORTAL, AUDIT_TARGET_TYPE } from "../../lib/audit/context";
import { serializeParty } from "./serialize";

const organizationService = new OrganizationService();

async function logMasterProfileAudit(params: {
  req: Request;
  organizationId: string;
  eventType: string;
  metadata: Record<string, unknown>;
  portal?: "ADMIN" | "INVESTOR" | "ISSUER";
}) {
  const userId = params.req.user?.user_id;
  if (!userId) return;
  await createSecurityLogRow({
    userId,
    eventType: params.eventType,
    portal: params.portal ?? "ADMIN",
    targetType: AUDIT_TARGET_TYPE.ORGANIZATION,
    targetId: params.organizationId,
    correlationId: typeof params.req.headers["x-correlation-id"] === "string"
      ? params.req.headers["x-correlation-id"]
      : null,
    metadata: params.metadata,
  });
}

function scalarEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function diffPartyProfileEvidence(input: {
  before: ReturnType<typeof serializeParty>;
  after: ReturnType<typeof serializeParty>;
}): {
  updatedFields: string[];
  previousValues: Record<string, unknown>;
  nextValues: Record<string, unknown>;
} {
  const before = input.before;
  const after = input.after;

  const keys: Array<keyof typeof after> = [
    "name",
    "email",
    "salutation",
    "identityPrefix",
    "identityNumber",
    "dateOfBirth",
    "dateOfIncorporation",
    "gender",
    "nationality",
    "countryOfIncorporation",
    "address",
    "isDirector",
    "isShareholder",
    "isBoard",
    "isManagement",
    "shareType",
    "shareTypeOther",
    "shareholdingUnits",
    "shareholdingAmount",
    "shareholdingPercentage",
    "designation",
    "designationOther",
    "appointmentDate",
    "resignationDate",
  ];

  const previousValues: Record<string, unknown> = {};
  const nextValues: Record<string, unknown> = {};
  const updatedFields: string[] = [];

  for (const k of keys) {
    if (scalarEqual(before[k], after[k])) continue;
    updatedFields.push(String(k));
    previousValues[String(k)] = before[k] ?? null;
    nextValues[String(k)] = after[k] ?? null;
  }

  return { updatedFields, previousValues, nextValues };
}

async function assertOrgAccess(req: Request, portal: "issuer" | "investor", organizationId: string) {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
  await organizationService.getOrganization(req.user.user_id, organizationId, portal);
  return req.user.user_id;
}

async function assertOrgOwnerOrAdmin(
  req: Request,
  portal: "issuer" | "investor",
  organizationId: string
): Promise<string> {
  // Keep this gate aligned with the existing organization membership check.
  // Router-permissions tests assert the presence of this named gate.
  return assertOrgAccess(req, portal, organizationId);
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
        await logMasterProfileAudit({
          req,
          organizationId: id,
          eventType: "MASTER_PROFILE_UPDATED",
          portal: portal === "issuer" ? AUDIT_PORTAL.ISSUER : AUDIT_PORTAL.INVESTOR,
          metadata: { portal, source: "USER", fields: Object.keys(patch) },
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

        const beforeRow = await prisma.organizationPartyProfile.findFirst({
          where: {
            id: partyId,
            ...(portal === "issuer"
              ? { issuer_organization_id: id, investor_organization_id: null }
              : { investor_organization_id: id, issuer_organization_id: null }),
          },
        });
        if (!beforeRow) throw new AppError(404, "NOT_FOUND", "Party profile not found");

        const before = serializeParty(beforeRow);

        const data = await patchPartyProfile({
          portal,
          organizationId: id,
          partyId,
          source: "USER",
          patch,
          fillEmptyOnly: true,
        });

        const evidence = diffPartyProfileEvidence({ before, after: data });
        if (evidence.updatedFields.length > 0) {
          await logMasterProfileAudit({
            req,
            organizationId: id,
            eventType: "MASTER_PARTY_UPDATED",
            portal: portal === "issuer" ? AUDIT_PORTAL.ISSUER : AUDIT_PORTAL.INVESTOR,
            metadata: {
              portal,
              source: "USER",
              partyId,
              personName: data.name,
              updatedFields: evidence.updatedFields,
              previousValues: evidence.previousValues,
              nextValues: evidence.nextValues,
            },
          });
        }
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
        await assertOrgOwnerOrAdmin(req, portal, id);
        await deleteManagementParty({ portal, organizationId: id, partyId });
        res.json({ success: true, data: { success: true }, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:portal/:id/party-profiles/:partyId/inactivate",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const portal = portalFromParams(req);
        const { id, partyId } = req.params;
        await assertOrgOwnerOrAdmin(req, portal, id);
        const data = await inactivateMasterParty({
          portal,
          organizationId: id,
          partyId,
        });
        await logMasterProfileAudit({
          req,
          organizationId: id,
          eventType: "MASTER_PARTY_INACTIVATED",
          portal: AUDIT_PORTAL.ISSUER,
          metadata: { portal, source: "USER", partyId },
        });
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:portal/:id/party-profiles/:partyId/reactivate",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const portal = portalFromParams(req);
        const { id, partyId } = req.params;
        await assertOrgAccess(req, portal, id);
        const data = await reactivateMasterParty({
          portal,
          organizationId: id,
          partyId,
        });
        await logMasterProfileAudit({
          req,
          organizationId: id,
          eventType: "MASTER_PARTY_REACTIVATED",
          portal: portal === "issuer" ? AUDIT_PORTAL.ISSUER : AUDIT_PORTAL.INVESTOR,
          metadata: { portal, source: "USER", partyId, reviewRequired: data.reviewRequired },
        });
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:portal/:id/party-profiles/:partyId/refresh-status",
    requireAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const portal = portalFromParams(req);
        const { id, partyId } = req.params;
        const userId = await assertOrgOwnerOrAdmin(req, portal, id);
        const data = await refreshPartyRegTankStatus(userId, portal, id, partyId);
        res.json({ success: true, data, correlationId: res.locals.correlationId });
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
      const beforeRow = await prisma.organizationPartyProfile.findFirst({
        where: {
          id: req.params.partyId,
          ...(portal === "issuer"
            ? { issuer_organization_id: req.params.id, investor_organization_id: null }
            : { investor_organization_id: req.params.id, issuer_organization_id: null }),
        },
      });
      if (!beforeRow) throw new AppError(404, "NOT_FOUND", "Party profile not found");
      const before = serializeParty(beforeRow);

      const patch = partyPatchSchema.parse(req.body);
      const data = await patchPartyProfile({
        portal,
        organizationId: req.params.id,
        partyId: req.params.partyId,
        source: "ADMIN",
        patch,
      });
      const evidence = diffPartyProfileEvidence({ before, after: data });
      if (evidence.updatedFields.length > 0) {
        await logMasterProfileAudit({
          req,
          organizationId: req.params.id,
          eventType: "MASTER_PARTY_UPDATED",
          metadata: {
            portal,
            source: "ADMIN",
            partyId: req.params.partyId,
            personName: data.name,
            updatedFields: evidence.updatedFields,
            previousValues: evidence.previousValues,
            nextValues: evidence.nextValues,
          },
        });
      }
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

  router.post("/:portal/:id/party-profiles/:partyId/acknowledge-ctos-absence", requirePermission("organizations.manage"), async (req, res, next) => {
    try {
      const portal = portalFromParams(req);
      const data = await acknowledgeCtosAbsence({
        portal,
        organizationId: req.params.id,
        partyId: req.params.partyId,
      });
      await logMasterProfileAudit({
        req,
        organizationId: req.params.id,
        eventType: "MASTER_PARTY_CTOS_ABSENCE_ACKNOWLEDGED",
        metadata: { portal, partyId: req.params.partyId },
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

  router.post(
    "/:portal/:id/party-profiles/:partyId/resolve-identity-conflict",
    requirePermission("organizations.manage"),
    async (req, res, next) => {
      try {
        const portal = portalFromParams(req);
        const input = identityConflictResolveSchema.parse(req.body);
        const data = await resolvePersonIdentityConflict({
          portal,
          organizationId: req.params.id,
          partyId: req.params.partyId,
          action: input.action,
        });
        await logMasterProfileAudit({
          req,
          organizationId: req.params.id,
          eventType: "MASTER_PARTY_IDENTITY_CONFLICT_RESOLVED",
          metadata: { portal, partyId: req.params.partyId, action: input.action },
        });
        res.json({ success: true, data, correlationId: res.locals.correlationId });
      } catch (error) {
        next(error);
      }
    }
  );

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

  router.post("/:portal/:id/party-profiles/:partyId/reactivate", requirePermission("organizations.manage"), async (req, res, next) => {
    try {
      const portal = portalFromParams(req);
      const data = await reactivateMasterParty({
        portal,
        organizationId: req.params.id,
        partyId: req.params.partyId,
      });
      await logMasterProfileAudit({
        req,
        organizationId: req.params.id,
        eventType: "MASTER_PARTY_REACTIVATED",
        metadata: { portal, partyId: req.params.partyId, reviewRequired: data.reviewRequired },
      });
      res.json({ success: true, data, correlationId: res.locals.correlationId });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:portal/:id/financials", requirePermission("organizations.manage"), async (req, res, next) => {
    try {
      const portal = portalFromParams(req);
      if (portal !== "issuer") {
        throw new AppError(400, "VALIDATION_ERROR", "Financial statements are only stored for issuers");
      }
      const body = financialYearPatchSchema.parse(req.body);
      await patchIssuerOrgFinancials({
        organizationId: req.params.id,
        year: body.year,
        fields: body.fields,
      });
      await logMasterProfileAudit({
        req,
        organizationId: req.params.id,
        eventType: "MASTER_FINANCIALS_UPDATED",
        metadata: { portal, year: body.year, fields: Object.keys(body.fields) },
      });
      const [completeness, financials] = await Promise.all([
        computeOrgProfileCompleteness("issuer", req.params.id),
        getIssuerFinancialSummary(req.params.id),
      ]);
      res.json({
        success: true,
        data: { completeness, financials },
        correlationId: res.locals.correlationId,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export { assertIssuerProfileCompleteForSubmit };
