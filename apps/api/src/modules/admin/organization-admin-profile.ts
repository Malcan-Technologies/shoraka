import type { UpdateAdminOrganizationProfileInput } from "@cashsouk/types";
import { UserRole } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import { createOnboardingLogRow } from "../../lib/audit";
import { buildOrganizationProfileAuditEvidence } from "./organization-profile-audit";

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
  const hasField = Object.values(input).some((value) => value !== undefined);
  if (!hasField) {
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
  if (input.name !== undefined) updateData.name = input.name;
  if (input.phoneNumber !== undefined) updateData.phone_number = input.phoneNumber;
  if (input.address !== undefined) updateData.address = input.address;
  if (input.firstName !== undefined) updateData.first_name = input.firstName;
  if (input.lastName !== undefined) updateData.last_name = input.lastName;
  if (input.middleName !== undefined) updateData.middle_name = input.middleName;
  if (input.bankAccountDetails !== undefined) {
    updateData.bank_account_details = input.bankAccountDetails;
  }
  if (input.corporateOnboardingData !== undefined) {
    if (org.type !== "COMPANY") {
      throw new AppError(400, "VALIDATION_ERROR", "Corporate fields can only be updated for company organizations");
    }
    updateData.corporate_onboarding_data = mergeCorporateOnboardingData(
      org.corporate_onboarding_data,
      input.corporateOnboardingData
    );
  }

  if (portal === "issuer") {
    await prisma.issuerOrganization.update({
      where: { id: organizationId },
      data: updateData,
    });
  } else {
    await prisma.investorOrganization.update({
      where: { id: organizationId },
      data: updateData,
    });
  }

  const { bankFieldsChanged } = summarizeProfilePatch(input);
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
      name: input.name !== undefined ? input.name : org.name,
      phoneNumber: input.phoneNumber !== undefined ? input.phoneNumber : org.phone_number,
      address: input.address !== undefined ? input.address : org.address,
      firstName: input.firstName !== undefined ? input.firstName : org.first_name,
      lastName: input.lastName !== undefined ? input.lastName : org.last_name,
      middleName: input.middleName !== undefined ? input.middleName : org.middle_name,
      corporateOnboardingData:
        (updateData.corporate_onboarding_data as unknown) ?? org.corporate_onboarding_data,
    },
    corporatePatch: input.corporateOnboardingData,
    bankFieldsChanged,
    organizationReference: org.display_reference,
  });
  await createOnboardingLogRow({
    userId: org.owner_user_id,
    investorOrganizationId: portal === "investor" ? organizationId : null,
    issuerOrganizationId: portal === "issuer" ? organizationId : null,
    organizationName: (input.name ?? org.name) || undefined,
    role: portal === "investor" ? UserRole.INVESTOR : UserRole.ISSUER,
    eventType: "PROFILE_UPDATED",
    portal,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
    deviceInfo: requestMeta.deviceInfo,
    deviceType: requestMeta.deviceType,
    metadata: {
      updatedBy: adminUserId,
      updatedFields: evidence.updatedFields,
      bankFieldsChanged: evidence.bankFieldsChanged,
      previousValues: evidence.previousValues,
      nextValues: evidence.nextValues,
      ...(evidence.organizationReference
        ? { organizationReference: evidence.organizationReference }
        : {}),
    },
    actorUserId: adminUserId,
  });

  return { success: true };
}
