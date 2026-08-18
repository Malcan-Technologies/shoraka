export interface BankAccountField {
  cn: boolean;
  fieldName: string;
  fieldType: string;
  fieldValue: string;
  alias?: string;
}

export interface BankAccountDetails {
  content: BankAccountField[];
  displayArea: string;
}

function bankFieldKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function bankFieldMatches(
  field: Pick<BankAccountField, "fieldName" | "alias">,
  fieldName: string
): boolean {
  const target = bankFieldKey(fieldName);
  if (bankFieldKey(field.fieldName) === target) return true;
  return Boolean(field.alias && bankFieldKey(field.alias) === target);
}

export function getBankAccountField(
  bankDetails: BankAccountDetails | null | undefined,
  fieldName: string
): string {
  if (!bankDetails?.content) return "";
  const field = bankDetails.content.find((item) => bankFieldMatches(item, fieldName));
  return field?.fieldValue ?? "";
}

export function buildBankAccountDetails(
  bankName: string,
  accountNumber: string,
  accountType: string
): BankAccountDetails {
  return {
    content: [
      { cn: false, fieldName: "Bank", fieldType: "picklist", fieldValue: bankName },
      {
        cn: false,
        fieldName: "Bank account number",
        fieldType: "number",
        fieldValue: accountNumber,
      },
      { cn: false, fieldName: "Account type", fieldType: "picklist", fieldValue: accountType },
    ],
    displayArea: "Bank Account Details",
  };
}

export function patchBankAccountDetails(
  existing: BankAccountDetails | null | undefined,
  updates: { bankName: string; accountNumber: string; accountType: string }
): BankAccountDetails {
  if (!existing?.content?.length) {
    return buildBankAccountDetails(updates.bankName, updates.accountNumber, updates.accountType);
  }

  const content = existing.content.map((field) => ({ ...field }));
  const apply = (canonicalName: string, fieldType: string, value: string) => {
    const index = content.findIndex((field) => bankFieldMatches(field, canonicalName));
    if (index >= 0) {
      content[index] = { ...content[index], fieldValue: value };
      return;
    }
    content.push({ cn: false, fieldName: canonicalName, fieldType, fieldValue: value });
  };

  apply("Bank", "picklist", updates.bankName);
  apply("Bank account number", "number", updates.accountNumber);
  apply("Account type", "picklist", updates.accountType);

  return {
    content,
    displayArea: existing.displayArea || "Bank Account Details",
  };
}
