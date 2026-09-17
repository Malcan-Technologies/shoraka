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
      const ic = signingIcFromPerson({
        matchKey: person.matchKey,
        identityNumber: person.identityNumber,
      });
      return {
        matchKey: String(person.matchKey ?? "").trim(),
        name: String(person.name ?? "").trim(),
        email: String(person.email ?? "").trim(),
        ic_number: ic || null,
      };
    })
    .filter((person) => person.matchKey.length > 0 && person.name.length > 0);
  return dedupeIssuerDirectors(fromPeople);
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
