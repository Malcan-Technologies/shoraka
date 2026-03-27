/**
 * Reads Government ID (IC) from RegTank corporate user info:
 * `formContent.content` field "Government ID Number", or `governmentIdNumber` on the user object.
 */
export function extractGovernmentIdFromCorporateUserInfo(
  userInfo: Record<string, unknown> | null | undefined
): string | null {
  if (!userInfo) return null;
  const formContent = (
    userInfo.formContent as
      | { content?: Array<{ fieldName?: string; fieldValue?: unknown }> }
      | undefined
  )?.content;
  const fromForm = formContent?.find((f) => f.fieldName === "Government ID Number")?.fieldValue;
  if (fromForm != null && String(fromForm).trim() !== "") {
    return String(fromForm).trim();
  }
  const fromRoot = userInfo.governmentIdNumber;
  if (fromRoot != null && String(fromRoot).trim() !== "") {
    return String(fromRoot).trim();
  }
  return null;
}
