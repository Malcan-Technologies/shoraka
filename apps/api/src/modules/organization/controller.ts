import { Request, Response, NextFunction, Router } from "express";
import { OrganizationService } from "./service";
import {
  createOrganizationSchema,
  addMemberSchema,
  organizationIdParamSchema,
  memberIdParamSchema,
  updateOrganizationProfileSchema,
  inviteMemberSchema,
  generateMemberInviteLinkSchema,
  acceptOrganizationInvitationSchema,
  changeMemberRoleSchema,
  transferOwnershipSchema,
  updateCorporateInfoSchema,
  patchCtosPartyEmailSchema,
  sendDirectorOnboardingSchema,
  PortalType,
} from "./schemas";
import { requireAuth } from "../../lib/auth/middleware";
import { AppError } from "../../lib/http/error-handler";
import { AMLSyncService } from "../regtank/aml-sync-service";
import { buildAdminPeopleList } from "../admin/build-people-list";
import { peopleHasPendingDirectorShareholderAml } from "@cashsouk/types";

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

    const companyPartyById = new Map<
      string,
      {
        people: ReturnType<typeof buildAdminPeopleList>;
        latestOrganizationCtosCompanyJson: unknown | null;
        ctosPartySupplements: { partyKey: string; onboardingJson: unknown }[];
      }
    >();
    await Promise.all(
      organizations
        .filter((o) => o.type === "COMPANY")
        .map(async (org) => {
          const extras =
            portalType === "investor"
              ? await organizationService.getInvestorPartyListExtras(org.id)
              : await organizationService.getIssuerPartyListExtras(org.id);
          const people = buildAdminPeopleList({
            ctos: extras.latestOrganizationCtosCompanyJson ?? null,
            issuerDirectorKycStatus: (org as { director_kyc_status?: unknown }).director_kyc_status ?? null,
            issuerDirectorAmlStatus: (org as { director_aml_status?: unknown }).director_aml_status ?? null,
            ctosPartySupplements: extras.ctosPartySupplements,
            corporateEntities: (org as { corporate_entities?: unknown }).corporate_entities ?? null,
          });
          companyPartyById.set(org.id, {
            people,
            latestOrganizationCtosCompanyJson: extras.latestOrganizationCtosCompanyJson,
            ctosPartySupplements: extras.ctosPartySupplements,
          });
        })
    );

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
          ownerId: org.owner_user_id,
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
            directorShareholderSubmitReady:
              org.type !== "COMPANY"
                ? true
                : !peopleHasPendingDirectorShareholderAml(companyPartyById.get(org.id)?.people ?? []),
            directorShareholderSubmitBlockedMessage:
              org.type === "COMPANY" &&
              peopleHasPendingDirectorShareholderAml(companyPartyById.get(org.id)?.people ?? [])
                ? "Please complete AML for all directors/shareholders before submitting."
                : undefined,
          }),
          // Corporate director KYC status (for COMPANY type)
          ...(org.type === "COMPANY" && {
            directorKycStatus: (org as { director_kyc_status?: unknown }).director_kyc_status
              ? ((org as { director_kyc_status: unknown }).director_kyc_status as {
                  corpIndvDirectorCount: number;
                  corpIndvShareholderCount: number;
                  corpBizShareholderCount: number;
                  directors: Array<{
                    eodRequestId: string;
                    name: string;
                    email: string;
                    role: string;
                    kycStatus: string;
                    kycId?: string;
                    lastUpdated: string;
                  }>;
                  lastSyncedAt: string;
                })
              : undefined,
            directorAmlStatus: (org as { director_aml_status?: unknown }).director_aml_status
              ? ((org as { director_aml_status: unknown }).director_aml_status as {
                  directors: Array<{
                    kycId: string;
                    name: string;
                    email: string;
                    role: string;
                    amlStatus: string;
                    amlMessageStatus: string;
                    amlRiskScore: number | null;
                    amlRiskLevel: string | null;
                    lastUpdated: string;
                  }>;
                  lastSyncedAt: string;
                })
              : undefined,
            corporateEntities: (org as { corporate_entities?: unknown }).corporate_entities
              ? ((org as { corporate_entities: unknown }).corporate_entities as {
                  directors?: Array<Record<string, unknown>>;
                  shareholders?: Array<Record<string, unknown>>;
                  corporateShareholders?: Array<Record<string, unknown>>;
                })
              : undefined,
            corporateOnboardingData: (org as { corporate_onboarding_data?: unknown }).corporate_onboarding_data
              ? ((org as { corporate_onboarding_data: unknown }).corporate_onboarding_data as {
                  basicInfo?: {
                    tin?: string;
                    tinNumber?: string;
                    industry?: string;
                    entityType?: string;
                    businessName?: string;
                    numberOfEmployees?: number | string;
                    ssmRegisterNumber?: string;
                    ssmRegistrationNumber?: string;
                    annualRevenue?: string;
                    website?: string;
                    phoneNumber?: string;
                  };
                  addresses?: {
                    business?: {
                      line1?: string | null;
                      line2?: string | null;
                      city?: string | null;
                      postalCode?: string | null;
                      state?: string | null;
                      country?: string | null;
                    };
                    registered?: {
                      line1?: string | null;
                      line2?: string | null;
                      city?: string | null;
                      postalCode?: string | null;
                      state?: string | null;
                      country?: string | null;
                    };
                    businessAddress?: string;
                    registeredAddress?: string;
                  };
                  personInCharge?: {
                    name?: string | null;
                    position?: string | null;
                    email?: string | null;
                    contactNumber?: string | null;
                  };
                })
              : undefined,
            ...(companyPartyById.get(org.id) ?? {}),
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

    const organization = await organizationService.createOrganization(req, userId, portalType, input);

    res.status(201).json({
      success: true,
      data: {
        id: organization.id,
        type: organization.type,
        name: organization.name,
        registrationNumber: organization.registration_number,
        onboardingStatus: organization.onboarding_status,
        createdAt: organization.created_at,
        ownerId: organization.owner_user_id,
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
    const issuerPartyExtras =
      portalType === "issuer" ? await organizationService.getIssuerPartyListExtras(organization.id) : null;
    const investorPartyExtras =
      portalType === "investor" ? await organizationService.getInvestorPartyListExtras(organization.id) : null;

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
      director_kyc_status?: unknown;
      director_aml_status?: unknown;
      corporate_onboarding_data?: unknown;
      corporate_entities?: unknown;
    };

    const peopleForSubmit =
      portalType === "issuer" && organization.type === "COMPANY" && issuerPartyExtras
        ? buildAdminPeopleList({
            ctos: issuerPartyExtras.latestOrganizationCtosCompanyJson ?? null,
            issuerDirectorKycStatus: org.director_kyc_status ?? null,
            issuerDirectorAmlStatus: org.director_aml_status ?? null,
            ctosPartySupplements: issuerPartyExtras.ctosPartySupplements,
            corporateEntities: org.corporate_entities ?? null,
          })
        : [];
    const issuerDsPending =
      portalType === "issuer" && organization.type === "COMPANY"
        ? peopleHasPendingDirectorShareholderAml(peopleForSubmit)
        : false;

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
        ownerId: organization.owner_user_id,
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
          ...(investorPartyExtras && {
            latestOrganizationCtosCompanyJson: investorPartyExtras.latestOrganizationCtosCompanyJson,
            latestOrganizationCtosFinancialsJson: investorPartyExtras.latestOrganizationCtosFinancialsJson,
            latestOrganizationCtosReportId: investorPartyExtras.latestOrganizationCtosReportId,
            latestOrganizationCtosFetchedAt: investorPartyExtras.latestOrganizationCtosFetchedAt,
            latestOrganizationCtosHasReportHtml: investorPartyExtras.latestOrganizationCtosHasReportHtml,
            latestOrganizationCtosSubjectReports: investorPartyExtras.latestOrganizationCtosSubjectReports,
            ctosPartySupplements: investorPartyExtras.ctosPartySupplements,
          }),
        }),
        // Issuer-specific flags
        ...(portalType === "issuer" && {
          ssmChecked: org.ssm_checked ?? false,
          directorShareholderSubmitReady: !issuerDsPending,
          directorShareholderSubmitBlockedMessage: issuerDsPending
            ? "Please complete AML for all directors/shareholders before submitting."
            : undefined,
          ...(issuerPartyExtras && {
            latestOrganizationCtosCompanyJson: issuerPartyExtras.latestOrganizationCtosCompanyJson,
            latestOrganizationCtosFinancialsJson: issuerPartyExtras.latestOrganizationCtosFinancialsJson,
            latestOrganizationCtosReportId: issuerPartyExtras.latestOrganizationCtosReportId,
            latestOrganizationCtosFetchedAt: issuerPartyExtras.latestOrganizationCtosFetchedAt,
            latestOrganizationCtosHasReportHtml: issuerPartyExtras.latestOrganizationCtosHasReportHtml,
            latestOrganizationCtosSubjectReports: issuerPartyExtras.latestOrganizationCtosSubjectReports,
            ctosPartySupplements: issuerPartyExtras.ctosPartySupplements,
          }),
        }),
        // Corporate director KYC status (for COMPANY type)
        ...(organization.type === "COMPANY" && {
          directorKycStatus: org.director_kyc_status
            ? (org.director_kyc_status as {
                corpIndvDirectorCount: number;
                corpIndvShareholderCount: number;
                corpBizShareholderCount: number;
                directors: Array<{
                  eodRequestId: string;
                  name: string;
                  email: string;
                  role: string;
                  kycStatus: string;
                  kycId?: string;
                  lastUpdated: string;
                }>;
                lastSyncedAt: string;
              })
            : undefined,
          directorAmlStatus: org.director_aml_status ?? null,
          corporateOnboardingData: (() => {
            if (!org.corporate_onboarding_data) return undefined;
            const data = org.corporate_onboarding_data as {
              basicInfo?: {
                tin?: string;
                tinNumber?: string;
                industry?: string;
                entityType?: string;
                businessName?: string;
                numberOfEmployees?: number | string;
                ssmRegistrationNumber?: string;
                ssmRegisterNumber?: string;
                annualRevenue?: string;
                website?: string;
                phoneNumber?: string;
              };
              addresses?: {
                business?: {
                  line1?: string | null;
                  line2?: string | null;
                  city?: string | null;
                  postalCode?: string | null;
                  state?: string | null;
                  country?: string | null;
                };
                registered?: {
                  line1?: string | null;
                  line2?: string | null;
                  city?: string | null;
                  postalCode?: string | null;
                  state?: string | null;
                  country?: string | null;
                };
                businessAddress?: string;
                registeredAddress?: string;
              };
              personInCharge?: {
                name?: string | null;
                position?: string | null;
                email?: string | null;
                contactNumber?: string | null;
              };
            };

            return {
              basicInfo: data.basicInfo
                ? {
                    // Map tin → tinNumber for backwards compatibility
                    tinNumber: data.basicInfo.tinNumber || data.basicInfo.tin || undefined,
                    industry: data.basicInfo.industry,
                    entityType: data.basicInfo.entityType,
                    businessName: data.basicInfo.businessName,
                    numberOfEmployees:
                      typeof data.basicInfo.numberOfEmployees === "string"
                        ? parseInt(data.basicInfo.numberOfEmployees, 10) || undefined
                        : data.basicInfo.numberOfEmployees,
                    // Map ssmRegistrationNumber → ssmRegisterNumber for backwards compatibility
                    ssmRegisterNumber:
                      data.basicInfo.ssmRegisterNumber ||
                      data.basicInfo.ssmRegistrationNumber ||
                      undefined,
                    annualRevenue: data.basicInfo.annualRevenue || undefined,
                    website: data.basicInfo.website || undefined,
                    phoneNumber: data.basicInfo.phoneNumber || undefined,
                  }
                : undefined,
              addresses: data.addresses
                ? {
                    // Return structured address objects
                    business: data.addresses.business || data.addresses.businessAddress || undefined,
                    registered: data.addresses.registered || data.addresses.registeredAddress || undefined,
                  }
                : undefined,
              personInCharge: data.personInCharge
                ? {
                    name: data.personInCharge.name || undefined,
                    position: data.personInCharge.position || undefined,
                    email: data.personInCharge.email || undefined,
                    contactNumber: data.personInCharge.contactNumber || undefined,
                  }
                : undefined,
            };
          })(),
          corporateEntities: org.corporate_entities
            ? (org.corporate_entities as {
                directors?: Array<Record<string, unknown>>;
                shareholders?: Array<Record<string, unknown>>;
                corporateShareholders?: Array<Record<string, unknown>>;
              })
            : undefined,
          people: buildAdminPeopleList({
            ctos:
              portalType === "issuer"
                ? (issuerPartyExtras?.latestOrganizationCtosCompanyJson ?? null)
                : (investorPartyExtras?.latestOrganizationCtosCompanyJson ?? null),
            issuerDirectorKycStatus: org.director_kyc_status ?? null,
            issuerDirectorAmlStatus: org.director_aml_status ?? null,
            ctosPartySupplements:
              portalType === "issuer"
                ? (issuerPartyExtras?.ctosPartySupplements ?? null)
                : (investorPartyExtras?.ctosPartySupplements ?? null),
            corporateEntities: org.corporate_entities ?? null,
          }),
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
 * Invite a member to an organization
 * POST /v1/organizations/investor/:id/members/invite
 * POST /v1/organizations/issuer/:id/members/invite
 */
async function inviteMember(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);
    const input = inviteMemberSchema.parse(req.body);

    const result = await organizationService.inviteMember(userId, id, portalType, input);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generate invitation link without sending email
 * POST /v1/organizations/investor/:id/members/generate-link
 * POST /v1/organizations/issuer/:id/members/generate-link
 */
async function generateMemberInvitationLink(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);
    const input = generateMemberInviteLinkSchema.parse(req.body);

    const result = await organizationService.generateMemberInvitationUrl(userId, id, portalType, input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Accept an organization invitation
 * POST /v1/organizations/invitations/accept
 */
async function acceptInvitation(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req);
    const input = acceptOrganizationInvitationSchema.parse(req.body);

    const result = await organizationService.acceptInvitation(userId, input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get pending invitations for an organization
 * GET /v1/organizations/investor/:id/invitations
 * GET /v1/organizations/issuer/:id/invitations
 */
async function getPendingInvitations(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);

    const invitations = await organizationService.getPendingInvitations(userId, id, portalType);

    res.json({
      success: true,
      data: { invitations },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Resend invitation email
 * POST /v1/organizations/investor/:id/invitations/:invitationId/resend
 * POST /v1/organizations/issuer/:id/invitations/:invitationId/resend
 */
async function resendInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);
    const { invitationId } = req.params;

    const result = await organizationService.resendInvitation(userId, id, portalType, invitationId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Revoke an invitation
 * DELETE /v1/organizations/investor/:id/invitations/:invitationId
 * DELETE /v1/organizations/issuer/:id/invitations/:invitationId
 */
async function revokeInvitation(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);
    const { invitationId } = req.params;

    const result = await organizationService.revokeInvitation(userId, id, portalType, invitationId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Leave an organization
 * POST /v1/organizations/investor/:id/leave
 * POST /v1/organizations/issuer/:id/leave
 */
async function leaveOrganization(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);

    const result = await organizationService.leaveOrganization(userId, id, portalType);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change member role (promote/demote)
 * PATCH /v1/organizations/investor/:id/members/:userId/role
 * PATCH /v1/organizations/issuer/:id/members/:userId/role
 */
async function changeMemberRole(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id, userId: targetUserId } = memberIdParamSchema.parse(req.params);
    const input = changeMemberRoleSchema.parse({ ...req.body, userId: targetUserId });

    const result = await organizationService.changeMemberRole(userId, id, portalType, input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Transfer organization ownership
 * POST /v1/organizations/investor/:id/transfer-ownership
 * POST /v1/organizations/issuer/:id/transfer-ownership
 */
async function transferOwnership(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);
    const input = transferOwnershipSchema.parse(req.body);

    const result = await organizationService.transferOwnership(userId, id, portalType, input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get corporate entities (directors, shareholders)
 * GET /v1/organizations/investor/:id/corporate-entities
 * GET /v1/organizations/issuer/:id/corporate-entities
 */
async function getCorporateEntities(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);

    const entities = await organizationService.getCorporateEntities(userId, id, portalType);

    res.json({
      success: true,
      data: entities,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update corporate info
 * PATCH /v1/organizations/investor/:id/corporate-info
 * PATCH /v1/organizations/issuer/:id/corporate-info
 */
async function updateCorporateInfo(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);
    const input = updateCorporateInfoSchema.parse(req.body);

    const result = await organizationService.updateCorporateInfo(userId, id, portalType, input);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /v1/organizations/:portal(investor|issuer)/:id/ctos-party-email
 */
async function patchCtosPartyEmail(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);
    const input = patchCtosPartyEmailSchema.parse(req.body);
    const result = await organizationService.upsertCtosPartyEmail(userId, id, portalType, input);
    res.json({
      success: true,
      data: result,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /v1/organizations/:portal(investor|issuer)/:id/send-director-onboarding
 */
async function sendDirectorOnboarding(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);
    const body = sendDirectorOnboardingSchema.parse(req.body);
    const data = await organizationService.sendDirectorCtosPartyOnboarding(userId, id, portalType, body);
    res.json({
      success: true,
      data,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Refresh AML status for an organization
 * POST /v1/organizations/investor/:id/refresh-aml
 * POST /v1/organizations/issuer/:id/refresh-aml
 */
async function refreshOrganizationAML(
  req: Request,
  res: Response,
  next: NextFunction,
  portalType: PortalType
) {
  try {
    const userId = getUserId(req);
    const { id } = organizationIdParamSchema.parse(req.params);

    // Verify user has access to organization (getOrganization throws if no access)
    await organizationService.getOrganization(userId, id, portalType);

    // Sync AML status (handles both existing and missing entities)
    const amlSyncService = new AMLSyncService();
    const amlStatus = await amlSyncService.syncOrganizationAMLStatus(id, portalType);

    // Return updated organization with fresh AML data
    res.json({
      success: true,
      data: {
        directorAmlStatus: amlStatus,
        lastSyncedAt: new Date().toISOString(),
      },
      correlationId: res.locals.correlationId,
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
  router.post("/investor/:id/members/invite", requireAuth, (req, res, next) =>
    inviteMember(req, res, next, "investor")
  );
  router.post("/investor/:id/members/generate-link", requireAuth, (req, res, next) =>
    generateMemberInvitationLink(req, res, next, "investor")
  );
  router.delete("/investor/:id/members/:userId", requireAuth, (req, res, next) =>
    removeMember(req, res, next, "investor")
  );
  router.post("/investor/:id/leave", requireAuth, (req, res, next) =>
    leaveOrganization(req, res, next, "investor")
  );
  router.patch("/investor/:id/members/:userId/role", requireAuth, (req, res, next) =>
    changeMemberRole(req, res, next, "investor")
  );
  router.post("/investor/:id/transfer-ownership", requireAuth, (req, res, next) =>
    transferOwnership(req, res, next, "investor")
  );
  router.get("/investor/:id/invitations", requireAuth, (req, res, next) =>
    getPendingInvitations(req, res, next, "investor")
  );
  router.post("/investor/:id/invitations/:invitationId/resend", requireAuth, (req, res, next) =>
    resendInvitation(req, res, next, "investor")
  );
  router.delete("/investor/:id/invitations/:invitationId", requireAuth, (req, res, next) =>
    revokeInvitation(req, res, next, "investor")
  );
  router.get("/investor/:id/corporate-entities", requireAuth, (req, res, next) =>
    getCorporateEntities(req, res, next, "investor")
  );
  router.patch("/investor/:id/corporate-info", requireAuth, (req, res, next) =>
    updateCorporateInfo(req, res, next, "investor")
  );
  router.post("/investor/:id/refresh-aml", requireAuth, (req, res, next) =>
    refreshOrganizationAML(req, res, next, "investor")
  );
  router.patch("/investor/:id/ctos-party-email", requireAuth, (req, res, next) =>
    patchCtosPartyEmail(req, res, next, "investor")
  );
  router.post("/investor/:id/send-director-onboarding", requireAuth, (req, res, next) =>
    sendDirectorOnboarding(req, res, next, "investor")
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
  router.post("/issuer/:id/members/invite", requireAuth, (req, res, next) =>
    inviteMember(req, res, next, "issuer")
  );
  router.post("/issuer/:id/members/generate-link", requireAuth, (req, res, next) =>
    generateMemberInvitationLink(req, res, next, "issuer")
  );
  router.delete("/issuer/:id/members/:userId", requireAuth, (req, res, next) =>
    removeMember(req, res, next, "issuer")
  );
  router.post("/issuer/:id/leave", requireAuth, (req, res, next) =>
    leaveOrganization(req, res, next, "issuer")
  );
  router.patch("/issuer/:id/members/:userId/role", requireAuth, (req, res, next) =>
    changeMemberRole(req, res, next, "issuer")
  );
  router.post("/issuer/:id/transfer-ownership", requireAuth, (req, res, next) =>
    transferOwnership(req, res, next, "issuer")
  );
  router.get("/issuer/:id/invitations", requireAuth, (req, res, next) =>
    getPendingInvitations(req, res, next, "issuer")
  );
  router.post("/issuer/:id/invitations/:invitationId/resend", requireAuth, (req, res, next) =>
    resendInvitation(req, res, next, "issuer")
  );
  router.delete("/issuer/:id/invitations/:invitationId", requireAuth, (req, res, next) =>
    revokeInvitation(req, res, next, "issuer")
  );
  router.get("/issuer/:id/corporate-entities", requireAuth, (req, res, next) =>
    getCorporateEntities(req, res, next, "issuer")
  );
  router.patch("/issuer/:id/corporate-info", requireAuth, (req, res, next) =>
    updateCorporateInfo(req, res, next, "issuer")
  );
  router.patch("/issuer/:id/ctos-party-email", requireAuth, (req, res, next) =>
    patchCtosPartyEmail(req, res, next, "issuer")
  );
  router.post("/issuer/:id/send-director-onboarding", requireAuth, (req, res, next) =>
    sendDirectorOnboarding(req, res, next, "issuer")
  );
  router.post("/issuer/:id/refresh-aml", requireAuth, (req, res, next) =>
    refreshOrganizationAML(req, res, next, "issuer")
  );

  // Shared invitation acceptance route
  router.post("/invitations/accept", requireAuth, acceptInvitation);

  return router;
}
