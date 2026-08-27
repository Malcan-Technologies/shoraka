import {
  getBankAccountField,
  patchBankAccountDetails,
  type BankAccountDetails,
} from "@cashsouk/config/src/bank-account-details";
import type {
  AdminOrganizationAddressInput,
  OrganizationDetailResponse,
  UpdateAdminOrganizationProfileInput,
} from "@cashsouk/types";
import { parseAboutYourBusiness } from "@cashsouk/types";

function asBankAccountDetails(data: unknown): BankAccountDetails | null {
  if (typeof data !== "object" || data === null) return null;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.content) || obj.content.length === 0) return null;
  const content = obj.content.flatMap((item) => {
    if (typeof item !== "object" || item === null || !("fieldName" in item)) return [];
    const field = item as Record<string, unknown>;
    return [
      {
        cn: Boolean(field.cn),
        fieldName: String(field.fieldName ?? ""),
        fieldType: String(field.fieldType ?? "text"),
        fieldValue: fieldValueToString(
          (field.fieldValue as string | boolean | string[] | null | undefined) ?? ""
        ),
        ...(typeof field.alias === "string" ? { alias: field.alias } : {}),
      },
    ];
  });
  if (content.length === 0) return null;
  return {
    content,
    displayArea: typeof obj.displayArea === "string" ? obj.displayArea : "Bank Account Details",
  };
}

type AddressDraft = {
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  state: string;
  country: string;
};

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function emptyAddress(): AddressDraft {
  return { line1: "", line2: "", city: "", postalCode: "", state: "", country: "" };
}

function addressToDraft(address?: {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  state?: string | null;
  country?: string | null;
} | null): AddressDraft {
  if (!address) return emptyAddress();
  return {
    line1: address.line1 ?? "",
    line2: address.line2 ?? "",
    city: address.city ?? "",
    postalCode: address.postalCode ?? "",
    state: address.state ?? "",
    country: address.country ?? "",
  };
}

function draftToAddress(draft: AddressDraft): AdminOrganizationAddressInput {
  return {
    line1: emptyToNull(draft.line1),
    line2: emptyToNull(draft.line2),
    city: emptyToNull(draft.city),
    postalCode: emptyToNull(draft.postalCode),
    state: emptyToNull(draft.state),
    country: emptyToNull(draft.country),
  };
}

function fieldValueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export type OrgProfileDraft = {
  name: string;
  phoneNumber: string;
  address: string;
  firstName: string;
  lastName: string;
  middleName: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  website: string;
  industry: string;
  entityType: string;
  numberOfEmployees: string;
  annualRevenue: string;
  tinNumber: string;
  businessName: string;
  businessAddress: AddressDraft;
  registeredAddress: AddressDraft;
  picName: string;
  picPosition: string;
  picEmail: string;
  picContactNumber: string;
  whatDoesCompanyDo: string;
  mainCustomers: string;
  singleCustomerOver50Revenue: boolean | null;
  accountingSoftware: string;
};

export type EditableSection =
  | "company"
  | "about"
  | "addresses"
  | "pic"
  | "personal"
  | "contact"
  | "bank";

export const SECTION_LABEL: Record<EditableSection, string> = {
  company: "company information",
  about: "about your business",
  addresses: "addresses",
  pic: "person in charge",
  personal: "personal details",
  contact: "contact details",
  bank: "bank account details",
};

export function buildDraft(org: OrganizationDetailResponse): OrgProfileDraft {
  const bank = asBankAccountDetails(org.bankAccountDetails);
  const about = parseAboutYourBusiness(org.corporateOnboardingData?.aboutYourBusiness);
  return {
    name: org.name ?? "",
    phoneNumber: org.phoneNumber ?? "",
    address: org.address ?? "",
    firstName: org.firstName ?? "",
    lastName: org.lastName ?? "",
    middleName: org.middleName ?? "",
    bankName: getBankAccountField(bank, "Bank"),
    accountType: getBankAccountField(bank, "Account type"),
    accountNumber: getBankAccountField(bank, "Bank account number"),
    website: org.corporateOnboardingData?.basicInfo?.website ?? "",
    industry: org.corporateOnboardingData?.basicInfo?.industry ?? "",
    entityType: org.corporateOnboardingData?.basicInfo?.entityType ?? "",
    numberOfEmployees:
      org.corporateOnboardingData?.basicInfo?.numberOfEmployees !== undefined
        ? String(org.corporateOnboardingData.basicInfo.numberOfEmployees)
        : "",
    annualRevenue: org.corporateOnboardingData?.basicInfo?.annualRevenue ?? "",
    tinNumber: org.corporateOnboardingData?.basicInfo?.tinNumber ?? "",
    businessName: org.corporateOnboardingData?.basicInfo?.businessName ?? "",
    businessAddress: addressToDraft(org.corporateOnboardingData?.addresses?.business),
    registeredAddress: addressToDraft(org.corporateOnboardingData?.addresses?.registered),
    picName: org.corporateOnboardingData?.personInCharge?.name ?? "",
    picPosition: org.corporateOnboardingData?.personInCharge?.position ?? "",
    picEmail: org.corporateOnboardingData?.personInCharge?.email ?? "",
    picContactNumber: org.corporateOnboardingData?.personInCharge?.contactNumber ?? "",
    whatDoesCompanyDo: about.whatDoesCompanyDo,
    mainCustomers: about.mainCustomers,
    singleCustomerOver50Revenue: about.singleCustomerOver50Revenue,
    accountingSoftware: about.accountingSoftware,
  };
}

function parseEmployeeCount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) return null;
  return parsed;
}

export function isValidEmployeeCountInput(value: string): boolean {
  return value.trim() === "" || parseEmployeeCount(value) !== null;
}

export function addressesEqual(left: AddressDraft, right: AddressDraft): boolean {
  return (
    left.line1 === right.line1 &&
    left.line2 === right.line2 &&
    left.city === right.city &&
    left.postalCode === right.postalCode &&
    left.state === right.state &&
    left.country === right.country
  );
}

export function buildSectionPayload(
  org: OrganizationDetailResponse,
  draft: OrgProfileDraft,
  section: EditableSection
): UpdateAdminOrganizationProfileInput {
  const original = buildDraft(org);
  const payload: UpdateAdminOrganizationProfileInput = {};

  if (section === "company") {
    if (emptyToNull(draft.name) !== emptyToNull(original.name)) {
      payload.name = emptyToNull(draft.name);
    }
    if (org.type === "COMPANY") {
      const companyChanged =
        emptyToNull(draft.website) !== emptyToNull(original.website) ||
        emptyToNull(draft.industry) !== emptyToNull(original.industry) ||
        emptyToNull(draft.entityType) !== emptyToNull(original.entityType) ||
        (isValidEmployeeCountInput(draft.numberOfEmployees) &&
          parseEmployeeCount(draft.numberOfEmployees) !== parseEmployeeCount(original.numberOfEmployees)) ||
        emptyToNull(draft.annualRevenue) !== emptyToNull(original.annualRevenue) ||
        emptyToNull(draft.tinNumber) !== emptyToNull(original.tinNumber) ||
        emptyToNull(draft.businessName) !== emptyToNull(original.businessName);
      if (companyChanged) {
        payload.corporateOnboardingData = {
          website: emptyToNull(draft.website),
          industry: emptyToNull(draft.industry),
          entityType: emptyToNull(draft.entityType),
          numberOfEmployees: isValidEmployeeCountInput(draft.numberOfEmployees)
            ? parseEmployeeCount(draft.numberOfEmployees)
            : parseEmployeeCount(original.numberOfEmployees),
          annualRevenue: emptyToNull(draft.annualRevenue),
          tinNumber: emptyToNull(draft.tinNumber),
          businessName: emptyToNull(draft.businessName),
        };
      }
    }
    return payload;
  }

  if (section === "addresses") {
    if (
      org.type === "COMPANY" &&
      (!addressesEqual(draft.businessAddress, original.businessAddress) ||
        !addressesEqual(draft.registeredAddress, original.registeredAddress))
    ) {
      payload.corporateOnboardingData = {
        addresses: {
          business: draftToAddress(draft.businessAddress),
          registered: draftToAddress(draft.registeredAddress),
        },
      };
    }
    return payload;
  }

  if (section === "about") {
    if (org.type === "COMPANY") {
      const originalAbout = parseAboutYourBusiness(org.corporateOnboardingData?.aboutYourBusiness);
      const aboutChanged =
        draft.whatDoesCompanyDo !== originalAbout.whatDoesCompanyDo ||
        draft.mainCustomers !== originalAbout.mainCustomers ||
        draft.singleCustomerOver50Revenue !== originalAbout.singleCustomerOver50Revenue ||
        draft.accountingSoftware !== originalAbout.accountingSoftware;
      if (aboutChanged) {
        payload.corporateOnboardingData = {
          aboutYourBusiness: {
            whatDoesCompanyDo: draft.whatDoesCompanyDo,
            mainCustomers: draft.mainCustomers,
            singleCustomerOver50Revenue: draft.singleCustomerOver50Revenue,
            accountingSoftware: draft.accountingSoftware,
          },
        };
      }
    }
    return payload;
  }

  if (section === "pic") {
    if (
      org.type === "COMPANY" &&
      (emptyToNull(draft.picName) !== emptyToNull(original.picName) ||
        emptyToNull(draft.picPosition) !== emptyToNull(original.picPosition) ||
        emptyToNull(draft.picEmail) !== emptyToNull(original.picEmail) ||
        emptyToNull(draft.picContactNumber) !== emptyToNull(original.picContactNumber))
    ) {
      payload.corporateOnboardingData = {
        personInCharge: {
          name: emptyToNull(draft.picName),
          position: emptyToNull(draft.picPosition),
          email: emptyToNull(draft.picEmail),
          contactNumber: emptyToNull(draft.picContactNumber),
        },
      };
    }
    return payload;
  }

  if (section === "personal") {
    if (org.type !== "COMPANY" && emptyToNull(draft.name) !== emptyToNull(original.name)) {
      payload.name = emptyToNull(draft.name);
    }
    if (emptyToNull(draft.firstName) !== emptyToNull(original.firstName)) {
      payload.firstName = emptyToNull(draft.firstName);
    }
    if (emptyToNull(draft.lastName) !== emptyToNull(original.lastName)) {
      payload.lastName = emptyToNull(draft.lastName);
    }
    if (emptyToNull(draft.middleName) !== emptyToNull(original.middleName)) {
      payload.middleName = emptyToNull(draft.middleName);
    }
    return payload;
  }

  if (section === "contact") {
    if (emptyToNull(draft.phoneNumber) !== emptyToNull(original.phoneNumber)) {
      payload.phoneNumber = emptyToNull(draft.phoneNumber);
    }
    if (emptyToNull(draft.address) !== emptyToNull(original.address)) {
      payload.address = emptyToNull(draft.address);
    }
    return payload;
  }

  const bankChanged =
    draft.bankName !== original.bankName ||
    draft.accountType !== original.accountType ||
    draft.accountNumber !== original.accountNumber;
  if (bankChanged) {
    const hasData = Boolean(draft.bankName || draft.accountNumber || draft.accountType);
    payload.bankAccountDetails = hasData
      ? patchBankAccountDetails(asBankAccountDetails(org.bankAccountDetails), {
          bankName: draft.bankName,
          accountNumber: draft.accountNumber,
          accountType: draft.accountType,
        })
      : null;
  }
  return payload;
}
