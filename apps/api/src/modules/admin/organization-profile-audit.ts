/**
 * Shared previous/next evidence for organisation PROFILE_UPDATED.
 * Stores only fields that actually changed; never dumps the whole organisation or bank JSON.
 */

function isPlainObjectRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function scalarChanged(previous: unknown, next: unknown): boolean {
  if (previous === next) return false;
  if (previous == null && next == null) return false;
  return JSON.stringify(previous) !== JSON.stringify(next);
}

function recordIfChanged(
  previousValues: Record<string, unknown>,
  nextValues: Record<string, unknown>,
  updatedFields: string[],
  field: string,
  previous: unknown,
  next: unknown
) {
  if (!scalarChanged(previous, next)) return;
  previousValues[field] = previous ?? null;
  nextValues[field] = next ?? null;
  updatedFields.push(field);
}

type CorporatePatch = {
  website?: string | null;
  industry?: string | null;
  entityType?: string | null;
  numberOfEmployees?: string | number | null;
  annualRevenue?: string | number | null;
  tinNumber?: string | null;
  businessName?: string | null;
  addresses?: {
    business?: unknown;
    registered?: unknown;
  };
  personInCharge?: {
    name?: string | null;
    position?: string | null;
    email?: string | null;
    contactNumber?: string | null;
  };
};

function nestedString(record: Record<string, unknown> | undefined, key: string): unknown {
  return record?.[key] ?? null;
}

export type OrganizationProfileSnapshot = {
  name?: string | null;
  phoneNumber?: string | null;
  address?: unknown;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  corporateOnboardingData?: unknown;
};

export function buildOrganizationProfileAuditEvidence(input: {
  previous: OrganizationProfileSnapshot;
  next: OrganizationProfileSnapshot;
  corporatePatch?: CorporatePatch;
  bankFieldsChanged?: boolean;
  organizationReference?: string | null;
}): {
  updatedFields: string[];
  previousValues: Record<string, unknown>;
  nextValues: Record<string, unknown>;
  bankFieldsChanged: boolean;
  organizationReference?: string;
} {
  const previousValues: Record<string, unknown> = {};
  const nextValues: Record<string, unknown> = {};
  const updatedFields: string[] = [];

  recordIfChanged(previousValues, nextValues, updatedFields, "name", input.previous.name, input.next.name);
  recordIfChanged(
    previousValues,
    nextValues,
    updatedFields,
    "phoneNumber",
    input.previous.phoneNumber,
    input.next.phoneNumber
  );
  recordIfChanged(
    previousValues,
    nextValues,
    updatedFields,
    "address",
    input.previous.address,
    input.next.address
  );
  recordIfChanged(
    previousValues,
    nextValues,
    updatedFields,
    "firstName",
    input.previous.firstName,
    input.next.firstName
  );
  recordIfChanged(
    previousValues,
    nextValues,
    updatedFields,
    "lastName",
    input.previous.lastName,
    input.next.lastName
  );
  recordIfChanged(
    previousValues,
    nextValues,
    updatedFields,
    "middleName",
    input.previous.middleName,
    input.next.middleName
  );

  const previousCorporate = isPlainObjectRecord(input.previous.corporateOnboardingData)
    ? input.previous.corporateOnboardingData
    : {};
  const nextCorporate = isPlainObjectRecord(input.next.corporateOnboardingData)
    ? input.next.corporateOnboardingData
    : {};
  const prevBasic = isPlainObjectRecord(previousCorporate.basicInfo)
    ? previousCorporate.basicInfo
    : {};
  const nextBasic = isPlainObjectRecord(nextCorporate.basicInfo) ? nextCorporate.basicInfo : {};
  const patch = input.corporatePatch;

  const basicKeys: Array<keyof CorporatePatch> = [
    "website",
    "industry",
    "entityType",
    "numberOfEmployees",
    "annualRevenue",
    "tinNumber",
    "businessName",
  ];
  for (const key of basicKeys) {
    if (patch && patch[key] === undefined) continue;
    recordIfChanged(
      previousValues,
      nextValues,
      updatedFields,
      `corporateOnboardingData.${key}`,
      nestedString(prevBasic, key),
      nestedString(nextBasic, key)
    );
  }

  const prevAddresses = isPlainObjectRecord(previousCorporate.addresses)
    ? previousCorporate.addresses
    : {};
  const nextAddresses = isPlainObjectRecord(nextCorporate.addresses) ? nextCorporate.addresses : {};
  if (!patch || patch.addresses !== undefined) {
    recordIfChanged(
      previousValues,
      nextValues,
      updatedFields,
      "corporateOnboardingData.addresses.business",
      prevAddresses.business ?? null,
      nextAddresses.business ?? null
    );
    recordIfChanged(
      previousValues,
      nextValues,
      updatedFields,
      "corporateOnboardingData.addresses.registered",
      prevAddresses.registered ?? null,
      nextAddresses.registered ?? null
    );
  }

  const prevPic = isPlainObjectRecord(previousCorporate.personInCharge)
    ? previousCorporate.personInCharge
    : {};
  const nextPic = isPlainObjectRecord(nextCorporate.personInCharge)
    ? nextCorporate.personInCharge
    : {};
  if (!patch || patch.personInCharge !== undefined) {
    for (const key of ["name", "position", "email", "contactNumber"] as const) {
      recordIfChanged(
        previousValues,
        nextValues,
        updatedFields,
        `corporateOnboardingData.personInCharge.${key}`,
        prevPic[key] ?? null,
        nextPic[key] ?? null
      );
    }
  }

  if (input.bankFieldsChanged) {
    updatedFields.push("bankAccountDetails");
  }

  const organizationReference = input.organizationReference?.trim() || undefined;
  return {
    updatedFields,
    previousValues,
    nextValues,
    bankFieldsChanged: Boolean(input.bankFieldsChanged),
    ...(organizationReference ? { organizationReference } : {}),
  };
}
