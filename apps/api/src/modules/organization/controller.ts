import { Request, Response, NextFunction, Router } from "express";
import { OrganizationService } from "./service";
import {
  createOrganizationSchema,
  addMemberSchema,
  organizationIdParamSchema,
  memberIdParamSchema,
  updateOrganizationProfileSchema,
  PortalType,
} from "./schemas";
import { requireAuth } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";

const organizationService = new OrganizationService();

/**
 * Get authenticated user ID from request
 */
function getUserId(req: Request): string {
  const user = (req as Request & { user?: { user_id: string } }).user;
  if (!user?.user_id) {
    throw new AppError(401, "UNAUTHORIZED", "User not authenticated");
  }
  return user.user_id;
}

/**
 * List organizations for the current user
 * GET /v1/organizations/investor
 * GET /v1/organizations/issuer
 */
async function listOrganizations(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const organizations = await organizationService.listOrganizations(userId, portalType);

    const hasPersonal = await organizationService.hasPersonalOrganization(userId, portalType);

    res.json({
      success: true,
      data: {
        organizations: organizations.map((org) => ({
          id: org.id,
          type: org.type,
          name: org.name,
          firstName: (org as { first_name?: string | null }).first_name || null,
          lastName: (org as { last_name?: string | null }).last_name || null,
          registrationNumber: org.registration_number,
          onboardingStatus: org.onboarding_status,
          onboardedAt: org.onboarded_at,
          isOwner: org.owner_user_id === userId,
          members: org.members.map(
            (m: {
              user_id: string;
              user: { email: string; first_name: string; last_name: string };
              role: string;
            }) => ({
              id: m.user_id,
              email: m.user.email,
              firstName: m.user.first_name,
              lastName: m.user.last_name,
              role: m.role,
            })
          ),
          regtankOnboardingStatus: org.regtank_onboarding?.status || null,
          regtankVerifyLink: org.regtank_onboarding?.verify_link || null,
          createdAt: org.created_at,
          // Approval workflow flags
          onboardingApproved: org.onboarding_approved,
          amlApproved: org.aml_approved,
          tncAccepted: org.tnc_accepted,
          // Investor-specific flags
          ...(portalType === "investor" && {
            depositReceived: (org as { deposit_received?: boolean }).deposit_received ?? false,
            ssmApproved: (org as { ssm_approved?: boolean }).ssm_approved ?? false,
          }),
          // Issuer-specific flags
          ...(portalType === "issuer" && {
            ssmChecked: (org as { ssm_checked?: boolean }).ssm_checked ?? false,
          }),
        })),
        hasPersonalOrganization: hasPersonal,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new organization
 * POST /v1/organizations/investor
 * POST /v1/organizations/issuer
 */
async function createOrganization(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const input = createOrganizationSchema.parse(req.body);

    const organization = await organizationService.createOrganization(userId, portalType, input);

    res.status(201).json({
      success: true,
      data: {
        id: organization.id,
        type: organization.type,
        name: organization.name,
        registrationNumber: organization.registration_number,
        onboardingStatus: organization.onboarding_status,
        createdAt: organization.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single organization
 * GET /v1/organizations/investor/:id
 * GET /v1/organizations/issuer/:id
 */
async function getOrganization(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);

    const organization = await organizationService.getOrganization(userId, id, portalType);

    // Cast to access all fields from the organization
    const org = organization as {
      first_name?: string | null;
      last_name?: string | null;
      middle_name?: string | null;
      nationality?: string | null;
      country?: string | null;
      id_issuing_country?: string | null;
      gender?: string | null;
      address?: string | null;
      date_of_birth?: Date | null;
      document_type?: string | null;
      document_number?: string | null;
      phone_number?: string | null;
      bank_account_details?: unknown;
      deposit_received?: boolean;
      ssm_approved?: boolean;
      ssm_checked?: boolean;
      is_sophisticated_investor?: boolean;
    };

    res.json({
      success: true,
      data: {
        id: organization.id,
        type: organization.type,
        name: organization.name,
        firstName: org.first_name || null,
        lastName: org.last_name || null,
        middleName: org.middle_name || null,
        registrationNumber: organization.registration_number,
        onboardingStatus: organization.onboarding_status,
        onboardedAt: organization.onboarded_at,
        isOwner: organization.owner_user_id === userId,
        members: organization.members.map(
          (m: {
            user_id: string;
            user: { email: string; first_name: string; last_name: string };
            role: string;
          }) => ({
            id: m.user_id,
            email: m.user.email,
            firstName: m.user.first_name,
            lastName: m.user.last_name,
            role: m.role,
          })
        ),
        regtankOnboardingStatus: organization.regtank_onboarding?.status || null,
        regtankVerifyLink: organization.regtank_onboarding?.verify_link || null,
        createdAt: organization.created_at,
        // KYC-verified fields (read-only)
        nationality: org.nationality || null,
        country: org.country || null,
        idIssuingCountry: org.id_issuing_country || null,
        gender: org.gender || null,
        dateOfBirth: org.date_of_birth || null,
        documentType: org.document_type || null,
        documentNumber: org.document_number || null,
        // Editable profile fields
        phoneNumber: org.phone_number || null,
        address: org.address || null,
        bankAccountDetails: org.bank_account_details || null,
        // Approval workflow flags
        onboardingApproved: organization.onboarding_approved,
        amlApproved: organization.aml_approved,
        tncAccepted: organization.tnc_accepted,
        // Investor-specific flags
        ...(portalType === "investor" && {
          depositReceived: org.deposit_received ?? false,
          ssmApproved: org.ssm_approved ?? false,
          isSophisticatedInvestor: org.is_sophisticated_investor ?? false,
        }),
        // Issuer-specific flags
        ...(portalType === "issuer" && {
          ssmChecked: org.ssm_checked ?? false,
        }),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Complete onboarding for an organization
 * POST /v1/organizations/investor/:id/complete-onboarding
 * POST /v1/organizations/issuer/:id/complete-onboarding
 */
async function completeOnboarding(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);

    const organization = await organizationService.completeOnboarding(req, userId, id, portalType);

    res.json({
      success: true,
      data: {
        id: organization.id,
        onboardingStatus: organization.onboarding_status,
        onboardedAt: organization.onboarded_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Add a member to an organization
 * POST /v1/organizations/investor/:id/members
 * POST /v1/organizations/issuer/:id/members
 */
async function addMember(req: Request, res: Response, next: NextFunction, portalType: PortalType) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);
    const input = addMemberSchema.parse(req.body);

    const result = await organizationService.addMember(userId, id, portalType, input);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Remove a member from an organization
 * DELETE /v1/organizations/investor/:id/members/:userId
 * DELETE /v1/organizations/issuer/:id/members/:userId
 */
async function removeMember(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id, userId: targetUserId } = memberIdParamSchema.parse(req.params);

    const result = await organizationService.removeMember(userId, id, targetUserId, portalType);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update organization profile (editable fields only)
 * PATCH /v1/organizations/investor/:id
 * PATCH /v1/organizations/issuer/:id
 */
async function updateOrganizationProfile(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);
    const input = updateOrganizationProfileSchema.parse(req.body);

    const result = await organizationService.updateOrganizationProfile(
      userId,
      id,
      portalType,
      input
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Accept Terms and Conditions for an organization
 * POST /v1/organizations/investor/:id/accept-tnc
 * POST /v1/organizations/issuer/:id/accept-tnc
 */
async function acceptTnc(req: Request, res: Response, next: NextFunction, portalType: PortalType) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);

    const result = await organizationService.acceptTnc(req, userId, id, portalType);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create router for organization routes
 */
export function createOrganizationRouter(): Router {
  const router = Router();

  // Investor organization routes
  router.get("/investor", requireAuth, (req, res, next) =>
    listOrganizations(req, res, next, "investor")
  );
  router.post("/investor", requireAuth, (req, res, next) =>
    createOrganization(req, res, next, "investor")
  );
  router.get("/investor/:id", requireAuth, (req, res, next) =>
    getOrganization(req, res, next, "investor")
  );
  router.patch("/investor/:id", requireAuth, (req, res, next) =>
    updateOrganizationProfile(req, res, next, "investor")
  );
  router.post("/investor/:id/complete-onboarding", requireAuth, (req, res, next) =>
    completeOnboarding(req, res, next, "investor")
  );
  router.post("/investor/:id/accept-tnc", requireAuth, (req, res, next) =>
    acceptTnc(req, res, next, "investor")
  );
  router.post("/investor/:id/members", requireAuth, (req, res, next) =>
    addMember(req, res, next, "investor")
  );
  router.delete("/investor/:id/members/:userId", requireAuth, (req, res, next) =>
    removeMember(req, res, next, "investor")
  );

  // Issuer organization routes
  router.get("/issuer", requireAuth, (req, res, next) =>
    listOrganizations(req, res, next, "issuer")
  );
  router.post("/issuer", requireAuth, (req, res, next) =>
    createOrganization(req, res, next, "issuer")
  );
  router.get("/issuer/:id", requireAuth, (req, res, next) =>
    getOrganization(req, res, next, "issuer")
  );
  router.patch("/issuer/:id", requireAuth, (req, res, next) =>
    updateOrganizationProfile(req, res, next, "issuer")
  );
  router.post("/issuer/:id/complete-onboarding", requireAuth, (req, res, next) =>
    completeOnboarding(req, res, next, "issuer")
  );
  router.post("/issuer/:id/accept-tnc", requireAuth, (req, res, next) =>
    acceptTnc(req, res, next, "issuer")
  );
  router.post("/issuer/:id/members", requireAuth, (req, res, next) =>
    addMember(req, res, next, "issuer")
  );
  router.delete("/issuer/:id/members/:userId", requireAuth, (req, res, next) =>
    removeMember(req, res, next, "issuer")
  );

  return router;
}
