import {
  firstIssueMessage,
  isValidProfilePhone,
  personalInvestorIdentityFormatKind,
  validateInvestorPersonalForm,
  validateInvestorResidentialAddressForm,
} from "@cashsouk/types";

export function personalDetailsSaveError(input: {
  gender: unknown;
  nationality: unknown;
  dateOfBirth: string;
  identityNumber?: string;
  identityKind?: ReturnType<typeof personalInvestorIdentityFormatKind>;
  validateIdentity?: boolean;
}): string | null {
  const issues = validateInvestorPersonalForm({
    gender: input.gender,
    nationality: input.nationality,
    ...(input.validateIdentity
      ? {
          identityNumber: input.identityNumber,
          identityKind: input.identityKind,
        }
      : {}),
  });
  if (issues.length > 0) return firstIssueMessage(issues);
  const dob = input.dateOfBirth.trim();
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return "Enter a valid Date of Birth.";
  }
  return null;
}

export function residentialAddressSaveError(input: {
  state: unknown;
  postalCode: unknown;
}): string | null {
  return firstIssueMessage(validateInvestorResidentialAddressForm(input));
}

export function contactDetailsSaveError(phoneNumber: string | undefined): string | null {
  if (phoneNumber && !isValidProfilePhone(phoneNumber)) {
    return "Enter a valid phone number.";
  }
  return null;
}
