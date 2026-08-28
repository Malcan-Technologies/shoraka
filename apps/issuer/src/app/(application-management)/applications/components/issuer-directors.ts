import {
  isValidSigningIcNumber,
  normalizeSigningIcNumber,
  type ApplicationPersonRow,
} from "@cashsouk/types";

export type IssuerDirectorOption = {
  matchKey: string;
  name: string;
  email: string;
  ic_number: string | null;
};

export function directorIcFromMatchKey(matchKey: string): string | null {
  const normalized = normalizeSigningIcNumber(matchKey);
  return normalized.length === 12 ? normalized : null;
}

export function dedupeIssuerDirectors(directors: IssuerDirectorOption[]): IssuerDirectorOption[] {
  const seen = new Set<string>();
  return directors.filter((director) => {
    const key = directorIcFromMatchKey(director.matchKey) ?? director.matchKey.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function issuerDirectorsFromOrganization(activeOrganization: unknown): IssuerDirectorOption[] {
  const org = activeOrganization as
    | {
        people?: ApplicationPersonRow[];
        directorKycStatus?: {
          directors?: Array<{
            name?: string;
            email?: string;
            role?: string;
            kycId?: string;
            eodRequestId?: string;
          }>;
        };
        directorAmlStatus?: {
          directors?: Array<{
            name?: string;
            email?: string;
            role?: string;
            kycId?: string;
          }>;
        };
      }
    | null
    | undefined;

  const fromPeople = (org?.people ?? [])
    .filter((person) => person.roles?.some((role) => role.toUpperCase() === "DIRECTOR"))
    .map((person) => ({
      matchKey: person.matchKey,
      name: String(person.name ?? "").trim(),
      email: String(person.email ?? "").trim(),
      ic_number: directorIcFromMatchKey(person.matchKey),
    }))
    .filter((person) => person.name.length > 0);
  if (fromPeople.length > 0) return dedupeIssuerDirectors(fromPeople);

  const fromKyc = (org?.directorKycStatus?.directors ?? [])
    .filter((director) => {
      const role = String(director.role ?? "").toUpperCase();
      return role.length === 0 || role.includes("DIRECTOR");
    })
    .map((director, index) => ({
      matchKey: director.kycId ?? director.eodRequestId ?? `director-kyc-${index}`,
      name: String(director.name ?? "").trim(),
      email: String(director.email ?? "").trim(),
      ic_number: directorIcFromMatchKey(
        director.kycId ?? director.eodRequestId ?? `director-kyc-${index}`
      ),
    }))
    .filter((director) => director.name.length > 0);
  if (fromKyc.length > 0) return dedupeIssuerDirectors(fromKyc);

  const fromAml = (org?.directorAmlStatus?.directors ?? [])
    .filter((director) => {
      const role = String(director.role ?? "").toUpperCase();
      return role.length === 0 || role.includes("DIRECTOR");
    })
    .map((director, index) => ({
      matchKey: director.kycId ?? `director-aml-${index}`,
      name: String(director.name ?? "").trim(),
      email: String(director.email ?? "").trim(),
      ic_number: directorIcFromMatchKey(director.kycId ?? `director-aml-${index}`),
    }))
    .filter((director) => director.name.length > 0);

  return dedupeIssuerDirectors(fromAml);
}

export function areIssuerDirectorSelectionsReady(
  directors: IssuerDirectorOption[],
  selectedMatchKeys: string[]
): boolean {
  if (selectedMatchKeys.length === 0) return false;
  return selectedMatchKeys.every((key) => {
    const director = directors.find((item) => item.matchKey === key);
    return Boolean(
      director &&
        director.email.trim() &&
        director.ic_number &&
        isValidSigningIcNumber(director.ic_number)
    );
  });
}
