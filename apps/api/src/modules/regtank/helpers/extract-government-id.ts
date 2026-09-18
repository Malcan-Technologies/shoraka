function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formFieldList(source: unknown): Array<Record<string, unknown>> {
  const rec = isRecord(source) ? source : null;
  const formContent = isRecord(rec?.formContent) ? rec.formContent : rec;
  if (!formContent) return [];
  const content = formContent.content;
  if (Array.isArray(content)) return content.filter(isRecord);
  if (isRecord(content) && Array.isArray(content.content)) {
    return content.content.filter(isRecord);
  }
  return [];
}

/**
 * Reads Government ID (IC) from RegTank corporate user info:
 * `formContent.content` or wrapped `formContent.content.content` field
 * "Government ID Number", or `governmentIdNumber` on the user object.
 */
export function extractGovernmentIdFromCorporateUserInfo(
  userInfo: Record<string, unknown> | null | undefined
): string | null {
  if (!userInfo) return null;
  const fromForm = formFieldList(userInfo).find((field) => field.fieldName === "Government ID Number")
    ?.fieldValue;
  if (fromForm != null && String(fromForm).trim() !== "") {
    return String(fromForm).trim();
  }
  const fromRoot = userInfo.governmentIdNumber;
  if (fromRoot != null && String(fromRoot).trim() !== "") {
    return String(fromRoot).trim();
  }
  return null;
}
