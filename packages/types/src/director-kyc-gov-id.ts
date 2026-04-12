/**
 * SECTION: Government ID from director_kyc_status by RegTank EOD
 * WHY: corporate_entities rows may omit personalInfo.governmentIdNumber while the KYC summary already has it; director rows can carry shareholderEodRequestId for the linked shareholder EOD
 * INPUT: director_kyc_status JSON; EOD request id (director EOD or individual shareholder EOD)
 * OUTPUT: trimmed IC or null
 * WHERE USED: admin issuer director table IC column; API CTOS subject resolve
 */
export function governmentIdFromDirectorKycForEod(
  directorKycStatus: unknown,
  eod: string
): string | null {
  const e = String(eod ?? "").trim();
  if (!e) return null;
  const kyc = directorKycStatus as Record<string, unknown> | null | undefined;
  const dirs = Array.isArray(kyc?.directors)
    ? (kyc!.directors as Record<string, unknown>[])
    : [];
  for (const d of dirs) {
    const primary = String(d.eodRequestId ?? "").trim();
    const shareholderEod = String(d.shareholderEodRequestId ?? "").trim();
    if (primary !== e && shareholderEod !== e) continue;
    const g = d.governmentIdNumber != null ? String(d.governmentIdNumber).trim() : "";
    if (g) return g;
  }
  const sh = Array.isArray(kyc?.individualShareholders)
    ? (kyc!.individualShareholders as Record<string, unknown>[])
    : [];
  for (const s of sh) {
    if (String(s.eodRequestId ?? "").trim() !== e) continue;
    const g = s.governmentIdNumber != null ? String(s.governmentIdNumber).trim() : "";
    if (g) return g;
  }
  return null;
}
