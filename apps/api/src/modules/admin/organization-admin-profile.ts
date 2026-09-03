import type { UpdateAdminOrganizationProfileInput } from "@cashsouk/types";
import { parseAboutYourBusiness, serializeAboutYourBusiness } from "@cashsouk/types";
import { UserRole } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import {
  AUDIT_ACTOR_TYPE,
  AUDIT_PORTAL,
  AUDIT_SOURCE,
  AUDIT_TARGET_TYPE,
  createSecurityLogRow,
  persistOrganizationUpdateAndOnboardingLogs,
} from "../../lib/audit";
import { patchOrgMasterProfile, type OrgMasterPatch } from "../organization-profile/service";
import { buildOrganizationProfileAuditEvidence } from "./organization-profile-audit";

const MASTER_ONLY_KEYS = [
  "dateOfIncorporation",
  "dateOfCommencement",
  "countryOfIncorporation",
  "scCompanyType",
  "companyCategory",
  "companyEmail",
  "scInvestorCategory",
  "residentialAddress",
  "gender",
  "nationality",
] as const;

export function extractMasterProfilePatch(
  input: UpdateAdminOrganizationProfileInput
): OrgMasterPatch {
  const patch: OrgMasterPatch = {};
  for (const key of MASTER_ONLY_KEYS) {
    if (input[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = input[key];
    }
  }
  if (input.name !== undefined) patch.name = input.name;
  if (input.phoneNumber !== undefined) patch.phoneNumber = input.phoneNumber;
  const addresses = input.corporateOnboardingData?.addresses;
  if (addresses?.registered !== undefined) patch.registeredAddress = addresses.registered;
  if (addresses?.business !== undefined) patch.businessAddress = addresses.business;
  const activities = input.corporateOnboardingData?.aboutYourBusiness?.whatDoesCompanyDo;
  if (activities !== undefined) patch.companyActivities = activities;
  return patch;
}

export function stripMasterOnlyProfileFields(
  input: UpdateAdminOrganizationProfileInput
): UpdateAdminOrganizationProfileInput {
  const operational: UpdateAdminOrganizationProfileInput = { ...input };
  for (const key of MASTER_ONLY_KEYS) {
    delete operational[key];
  }
  return operational;
}

function hasDefinedProfileFields(input: object): boolean {
  return Object.values(input).some((value) => value !== undefined);
}

function isPlainObjectRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

export function mergeCorporateOnboardingData(
  existing: unknown,
  patch: NonNullable<UpdateAdminOrganizationProfileInput["corporateOnboardingData"]>
): Record<string, unknown> {
  const current = isPlainObjectRecord(existing) ? { ...existing } : {};
  const basicInfo = isPlainObjectRecord(current.basicInfo) ? { ...current.basicInfo } : {};

  if (patch.website !== undefined) basicInfo.website = patch.website ?? undefined;
  if (patch.industry !== undefined) basicInfo.industry = patch.industry ?? undefined;
  if (patch.entityType !== undefined) basicInfo.entityType = patch.entityType ?? undefined;
  if (patch.numberOfEmployees !== undefined) {
    basicInfo.numberOfEmployees = patch.numberOfEmployees ?? undefined;
  }
  if (patch.annualRevenue !== undefined) basicInfo.annualRevenue = patch.annualRevenue ?? undefined;
  if (patch.tinNumber !== undefined) basicInfo.tinNumber = patch.tinNumber ?? undefined;
  if (patch.businessName !== undefined) basicInfo.businessName = patch.businessName ?? undefined;
  current.basicInfo = basicInfo;

  if (patch.addresses) {
    const addresses = isPlainObjectRecord(current.addresses) ? { ...current.addresses } : {};
    if (patch.addresses.business !== undefined) addresses.business = patch.addresses.business;
    if (patch.addresses.registered !== undefined) addresses.registered = patch.addresses.registered;
    current.addresses = addresses;
  }

  if (patch.personInCharge) {
    const pic = isPlainObjectRecord(current.personInCharge) ? { ...current.personInCharge } : {};
    if (patch.personInCharge.name !== undefined) pic.name = patch.personInCharge.name;
    if (patch.personInCharge.position !== undefined) pic.position = patch.personInCharge.position;
    if (patch.personInCharge.email !== undefined) {
      pic.email = patch.personInCharge.email === "" ? null : patch.personInCharge.email;
    }
    if (patch.personInCharge.contactNumber !== undefined) {
      pic.contactNumber = patch.personInCharge.contactNumber;
    }
    current.personInCharge = pic;
  }

  if (patch.aboutYourBusiness !== undefined) {
    if (patch.aboutYourBusiness === null) {
      current.aboutYourBusiness = undefined;
    } else {
      const existingAbout = parseAboutYourBusiness(current.aboutYourBusiness);
      const merged = {
        whatDoesCompanyDo:
          patch.aboutYourBusiness.whatDoesCompanyDo !== undefined
            ? (patch.aboutYourBusiness.whatDoesCompanyDo ?? "")
            : existingAbout.whatDoesCompanyDo,
        mainCustomers:
          patch.aboutYourBusiness.mainCustomers !== undefined
            ? (patch.aboutYourBusiness.mainCustomers ?? "")
            : existingAbout.mainCustomers,
        singleCustomerOver50Revenue:
          patch.aboutYourBusiness.singleCustomerOver50Revenue !== undefined
            ? patch.aboutYourBusiness.singleCustomerOver50Revenue
            : existingAbout.singleCustomerOver50Revenue,
        accountingSoftware:
          patch.aboutYourBusiness.accountingSoftware !== undefined
            ? (patch.aboutYourBusiness.accountingSoftware ?? "")
            : existingAbout.accountingSoftware,
      };
      current.aboutYourBusiness = serializeAboutYourBusiness(merged);
    }
  }

  return current;
}

export function summarizeProfilePatch(
  input: UpdateAdminOrganizationProfileInput
): { updatedFields: string[]; bankFieldsChanged: boolean } {
  const updatedFields = Object.keys(input).filter(
    (key) => input[key as keyof UpdateAdminOrganizationProfileInput] !== undefined
  );
  return {
    updatedFields,
    bankFieldsChanged: input.bankAccountDetails !== undefined,
  };
}

export async function updateAdminOrganizationProfile(params: {
  portal: "issuer" | "investor";
  organizationId: string;
  adminUserId: string;
  input: UpdateAdminOrganizationProfileInput;
  requestMeta: {
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: string;
    deviceType?: string;
  };
}): Promise<{ success: true }> {
  const { portal, organizationId, adminUserId, input, requestMeta } = params;
  const masterPatch = extractMasterProfilePatch(input);
  const operational = stripMasterOnlyProfileFields(input);
  const hasMaster = hasDefinedProfileFields(masterPatch);
  const hasOperational = hasDefinedProfileFields(operational);
  if (!hasOperational && !hasMaster) {
    throw new AppError(400, "VALIDATION_ERROR", "No profile fields to update");
  }

  const org =
    portal === "issuer"
      ? await prisma.issuerOrganization.findUnique({
          where: { id: organizationId },
          select: {
            id: true,
            owner_user_id: true,
            name: true,
            phone_number: true,
            address: true,
            first_name: true,
            last_name: true,
            middle_name: true,
            corporate_onboarding_data: true,
            type: true,
            display_reference: true,
          },
        })
      : await prisma.investorOrganization.findUnique({
          where: { id: organizationId },
          select: {
            id: true,
            owner_user_id: true,
            name: true,
            phone_number: true,
            address: true,
            first_name: true,
            last_name: true,
            middle_name: true,
            corporate_onboarding_data: true,
            type: true,
            display_reference: true,
          },
        });

  if (!org) {
    throw new AppError(404, "NOT_FOUND", "Organization not found");
  }

  const updateData: Record<string, unknown> = {};
  if (hasOperational) {
    if (operational.name !== undefined) updateData.name = operational.name;
    if (operational.phoneNumber !== undefined) updateData.phone_number = operational.phoneNumber;
    if (operational.address !== undefined) updateData.address = operational.address;
    if (operational.firstName !== undefined) updateData.first_name = operational.firstName;
    if (operational.lastName !== undefined) updateData.last_name = operational.lastName;
    if (operational.middleName !== undefined) updateData.middle_name = operational.middleName;
    if (operational.bankAccountDetails !== undefined) {
      updateData.bank_account_details = operational.bankAccountDetails;
    }
    if (operational.corporateOnboardingData !== undefined) {
      if (org.type !== "COMPANY") {
        throw new AppError(400, "VALIDATION_ERROR", "Corporate fields can only be updated for company organizations");
      }
      updateData.corporate_onboarding_data = mergeCorporateOnboardingData(
        org.corporate_onboarding_data,
        operational.corporateOnboardingData
      );
    }
  }

  const { bankFieldsChanged } = summarizeProfilePatch(operational);
  const masterFieldNames = Object.keys(masterPatch);
  const evidence = buildOrganizationProfileAuditEvidence({
    previous: {
      name: org.name,
      phoneNumber: org.phone_number,
      address: org.address,
      firstName: org.first_name,
      lastName: org.last_name,
      middleName: org.middle_name,
      corporateOnboardingData: org.corporate_onboarding_data,
    },
    next: {
      name: operational.name !== undefined ? operational.name : org.name,
      phoneNumber: operational.phoneNumber !== undefined ? operational.phoneNumber : org.phone_number,
      address: operational.address !== undefined ? operational.address : org.address,
      firstName: operational.firstName !== undefined ? operational.firstName : org.first_name,
      lastName: operational.lastName !== undefined ? operational.lastName : org.last_name,
      middleName: operational.middleName !== undefined ? operational.middleName : org.middle_name,
      corporateOnboardingData:
        (updateData.corporate_onboarding_data as unknown) ?? org.corporate_onboarding_data,
    },
    corporatePatch: operational.corporateOnboardingData,
    bankFieldsChanged,
    organizationReference: org.display_reference,
  });
  const updatedFields = Array.from(new Set([...evidence.updatedFields, ...masterFieldNames]));

  if (Object.keys(updateData).length > 0) {
    await persistOrganizationUpdateAndOnboardingLogs({
      portalType: portal,
      organizationId,
      data: updateData,
      logs: [
        {
          userId: org.owner_user_id,
          investorOrganizationId: portal === "investor" ? organizationId : null,
          issuerOrganizationId: portal === "issuer" ? organizationId : null,
          organizationName: (operational.name ?? org.name) || undefined,
          role: portal === "investor" ? UserRole.INVESTOR : UserRole.ISSUER,
          eventType: "PROFILE_UPDATED",
          portal: AUDIT_PORTAL.ADMIN,
          ipAddress: requestMeta.ipAddress,
          userAgent: requestMeta.userAgent,
          deviceInfo: requestMeta.deviceInfo,
          deviceType: requestMeta.deviceType,
          metadata: {
            updatedBy: adminUserId,
            updatedFields,
            bankFieldsChanged: evidence.bankFieldsChanged,
            previousValues: evidence.previousValues,
            nextValues: evidence.nextValues,
            subjectPortal: portal,
            ...(evidence.organizationReference
              ? { organizationReference: evidence.organizationReference }
              : {}),
          },
          actorUserId: adminUserId,
          context: {
            actorType: AUDIT_ACTOR_TYPE.ADMIN,
            actorUserId: adminUserId,
            source: AUDIT_SOURCE.API,
            portal: AUDIT_PORTAL.ADMIN,
            ipAddress: requestMeta.ipAddress ?? null,
            userAgent: requestMeta.userAgent ?? null,
            correlationId: null,
          },
        },
      ],
    });
  } else if (hasMaster) {
    await createSecurityLogRow({
      userId: adminUserId,
      eventType: "PROFILE_UPDATED",
      portal: AUDIT_PORTAL.ADMIN,
      targetType: AUDIT_TARGET_TYPE.ORGANIZATION,
      targetId: organizationId,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
      metadata: {
        updatedBy: adminUserId,
        updatedFields,
        subjectPortal: portal,
      },
      context: {
        actorType: AUDIT_ACTOR_TYPE.ADMIN,
        actorUserId: adminUserId,
        source: AUDIT_SOURCE.API,
        portal: AUDIT_PORTAL.ADMIN,
        ipAddress: requestMeta.ipAddress ?? null,
        userAgent: requestMeta.userAgent ?? null,
        correlationId: null,
      },
    });
  }

  if (hasMaster) {
    await patchOrgMasterProfile({
      portal,
      organizationId,
      actorUserId: adminUserId,
      source: "ADMIN",
      patch: masterPatch,
    });
  }

  return { success: true };
}
