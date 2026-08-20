import type { Prisma } from "@prisma/client";
import type { UpdateAdminOrganizationProfileInput } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { prisma } from "../../lib/prisma";
import type { AuditRequestContext } from "../../lib/audit/context";
import { changedFieldsOf } from "../../lib/audit/snapshot";
import { writeOnboardingAuditLog } from "../onboarding/audit/writer";
import { ONBOARDING_AUDIT_TARGET_TYPE } from "../onboarding/audit/events";

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

function asAuditScalar(value: string | null | undefined): string | null {
  return value ?? null;
}

function corporateOnboardingChangedFields(
  patch: NonNullable<UpdateAdminOrganizationProfileInput["corporateOnboardingData"]>
): string[] {
  const fields: string[] = [];
  if (patch.website !== undefined) fields.push("website");
  if (patch.industry !== undefined) fields.push("industry");
  if (patch.entityType !== undefined) fields.push("entityType");
  if (patch.numberOfEmployees !== undefined) fields.push("numberOfEmployees");
  if (patch.annualRevenue !== undefined) fields.push("annualRevenue");
  if (patch.tinNumber !== undefined) fields.push("tinNumber");
  if (patch.businessName !== undefined) fields.push("businessName");
  if (patch.addresses?.business !== undefined) fields.push("addresses.business");
  if (patch.addresses?.registered !== undefined) fields.push("addresses.registered");
  if (patch.personInCharge?.name !== undefined) fields.push("personInCharge.name");
  if (patch.personInCharge?.position !== undefined) fields.push("personInCharge.position");
  if (patch.personInCharge?.email !== undefined) fields.push("personInCharge.email");
  if (patch.personInCharge?.contactNumber !== undefined) fields.push("personInCharge.contactNumber");
  return fields;
}

export async function updateAdminOrganizationProfile(params: {
  portal: "issuer" | "investor";
  organizationId: string;
  input: UpdateAdminOrganizationProfileInput;
  context: AuditRequestContext;
}): Promise<{ success: true }> {
  const { portal, organizationId, input, context } = params;
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

  const before = {
    name: asAuditScalar(org.name),
    phoneNumber: asAuditScalar(org.phone_number),
    address: asAuditScalar(org.address),
    firstName: asAuditScalar(org.first_name),
    lastName: asAuditScalar(org.last_name),
    middleName: asAuditScalar(org.middle_name),
  };
  const after = {
    name: input.name !== undefined ? asAuditScalar(input.name) : before.name,
    phoneNumber: input.phoneNumber !== undefined ? asAuditScalar(input.phoneNumber) : before.phoneNumber,
    address: input.address !== undefined ? asAuditScalar(input.address) : before.address,
    firstName: input.firstName !== undefined ? asAuditScalar(input.firstName) : before.firstName,
    lastName: input.lastName !== undefined ? asAuditScalar(input.lastName) : before.lastName,
    middleName: input.middleName !== undefined ? asAuditScalar(input.middleName) : before.middleName,
  };
  const changedFields = [...changedFieldsOf(before, after)];
  const bankAccountDetailsChanged = input.bankAccountDetails !== undefined;
  if (bankAccountDetailsChanged) changedFields.push("bankAccountDetails");
  const corporateChanged =
    input.corporateOnboardingData !== undefined
      ? corporateOnboardingChangedFields(input.corporateOnboardingData)
      : [];
  if (corporateChanged.length > 0) changedFields.push("corporateOnboardingData");

  await prisma.$transaction(async (tx) => {
    if (portal === "issuer") {
      await tx.issuerOrganization.update({
        where: { id: organizationId },
        data: updateData as Prisma.IssuerOrganizationUpdateInput,
      });
    } else {
      await tx.investorOrganization.update({
        where: { id: organizationId },
        data: updateData as Prisma.InvestorOrganizationUpdateInput,
      });
    }

    if (changedFields.length === 0) {
      return;
    }

    await writeOnboardingAuditLog(
      {
        eventType: "ORGANIZATION_PROFILE_UPDATED_BY_ADMIN",
        context,
        subjectUserId: org.owner_user_id,
        organizationId,
        organizationKind: portal === "investor" ? "INVESTOR" : "ISSUER",
        organizationType: org.type,
        targetType: ONBOARDING_AUDIT_TARGET_TYPE.ORGANIZATION,
        targetId: organizationId,
        metadata: {
          changedFields,
          before,
          after,
          bankAccountDetailsChanged,
          ...(corporateChanged.length > 0
            ? { corporateOnboardingChangedFields: corporateChanged }
            : {}),
        },
      },
      tx
    );
  });

  return { success: true };
}
