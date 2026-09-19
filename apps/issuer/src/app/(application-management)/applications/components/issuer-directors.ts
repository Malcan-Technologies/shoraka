import {
  isValidSigningIcNumber,
  signingIcFromPerson,
  type ApplicationPersonRow,
} from "@cashsouk/types";

export type IssuerDirectorOption = {
  matchKey: string;
  name: string;
  email: string;
  ic_number: string | null;
};

export function dedupeIssuerDirectors(directors: IssuerDirectorOption[]): IssuerDirectorOption[] {
  const seen = new Set<string>();
  return directors.filter((director) => {
    const key = director.ic_number || director.matchKey.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function issuerDirectorsFromPeople(
  people: ApplicationPersonRow[] | null | undefined
): IssuerDirectorOption[] {
  const fromPeople = (people ?? [])
    .filter((person) => {
      if (person.entityType === "CORPORATE") return false;
      return person.roles?.some((role) => role.toUpperCase() === "DIRECTOR");
    })
    .map((person) => {
      const matchKey = String(person.matchKey ?? "").trim();
      const ic = signingIcFromPerson({
        matchKey,
        identityNumber: person.identityNumber,
      });
      const normalizedIc = ic && ic.trim().length > 0 ? ic.trim() : null;
      return {
        matchKey,
        name: String(person.name ?? "").trim(),
        email: String(person.email ?? "").trim(),
        // Some legacy rows store the signing IC directly in `matchKey` even when `identityNumber` is missing.
        // Preserve it if it already looks like a valid IC.
        ic_number:
          normalizedIc ??
          (!person.identityNumber && isValidSigningIcNumber(matchKey) ? matchKey : null),
      };
    })
    .filter((person) => person.matchKey.length > 0 && person.name.length > 0);
  return dedupeIssuerDirectors(fromPeople);
}

export type IssuerDirectorSelectionIssue =
  | { kind: "none_selected" }
  | { kind: "missing_email" }
  | { kind: "missing_ic" };

export function issuerDirectorSelectionIssue(
  directors: IssuerDirectorOption[],
  selectedMatchKeys: string[]
): IssuerDirectorSelectionIssue | null {
  const keys = selectedMatchKeys.map((key) => key.trim()).filter(Boolean);
  if (keys.length === 0) return { kind: "none_selected" };

  for (const key of keys) {
    const director = directors.find((item) => item.matchKey === key);
    if (!director) return { kind: "none_selected" };
    if (!director.email.trim()) return { kind: "missing_email" };
    if (!director.ic_number || !isValidSigningIcNumber(director.ic_number)) {
      return { kind: "missing_ic" };
    }
  }
  return null;
}

export function areIssuerDirectorSelectionsReady(
  directors: IssuerDirectorOption[],
  selectedMatchKeys: string[]
): boolean {
  return issuerDirectorSelectionIssue(directors, selectedMatchKeys) === null;
}
