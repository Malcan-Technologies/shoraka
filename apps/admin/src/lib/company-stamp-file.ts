import { companyStampDeclaredFileRejection } from "@cashsouk/types";

/** Client-side stamp checks: same type and 5 MB rules as Trustee Signature. */
export function validateCompanyStampFile(file: { type: string; size: number }): string | null {
  return companyStampDeclaredFileRejection(file.type, file.size);
}
