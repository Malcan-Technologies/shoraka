import {
  AUTHORIZED_PARTY_ISSUER_KEY,
  getIssuerAuthorizedParty,
  type AuthorizedPartiesSnapshot,
  type AuthorizedPartiesSubmitPayload,
} from "@cashsouk/types";
import { type IssuerDirectorOption } from "./issuer-directors";

export type ApplicationGuarantorRow = {
  id: string;
  client_guarantor_id?: string | null;
  guarantor_type: "individual" | "company";
  name?: string | null;
  business_name?: string | null;
  email: string;
  ic_number?: string | null;
};

export function guarantorsFromApplication(rows: unknown): ApplicationGuarantorRow[] {
  if (!Array.isArray(rows)) return [];
  const result: ApplicationGuarantorRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const guarantor = row as Record<string, unknown>;
    const id = typeof guarantor.id === "string" ? guarantor.id : "";
    if (!id) continue;
    result.push({
      id,
      client_guarantor_id:
        typeof (guarantor.client_guarantor_id ?? guarantor.clientGuarantorId) === "string"
          ? String(guarantor.client_guarantor_id ?? guarantor.clientGuarantorId)
          : null,
      guarantor_type: guarantor.guarantor_type === "company" ? "company" : "individual",
      name: typeof guarantor.name === "string" ? guarantor.name : null,
      business_name:
        typeof guarantor.business_name === "string" ? guarantor.business_name : null,
      email: typeof guarantor.email === "string" ? guarantor.email : "",
      ic_number: typeof guarantor.ic_number === "string" ? guarantor.ic_number : null,
    });
  }
  return result;
}

export function buildIssuerAuthorizedPartiesSubmitPayload(
  directors: IssuerDirectorOption[],
  selectedMatchKeys: string[]
): AuthorizedPartiesSubmitPayload {
  const representatives = selectedMatchKeys.flatMap((key) => {
    const director = directors.find((item) => item.matchKey === key);
    if (!director) return [];
    return [
      {
        name: director.name,
        email: director.email,
        ic_number: director.ic_number ?? "",
        capacity: "director" as const,
        person_match_key: director.matchKey,
      },
    ];
  });
  return {
    parties: [
      {
        key: AUTHORIZED_PARTY_ISSUER_KEY,
        entity_kind: "ISSUER",
        representatives,
      },
    ],
  };
}

export function issuerDirectorMatchKeysFromSnapshot(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  directors: IssuerDirectorOption[]
): string[] {
  const party = getIssuerAuthorizedParty(snapshot);
  if (!party) return [];
  const keys: string[] = [];
  for (const representative of party.representatives) {
    const byKey = directors.find((item) => item.matchKey === representative.person_match_key);
    const byEmail = directors.find(
      (item) => item.email.trim().toLowerCase() === representative.email.trim().toLowerCase()
    );
    const matchKey = byKey?.matchKey ?? byEmail?.matchKey;
    if (matchKey && !keys.includes(matchKey)) keys.push(matchKey);
  }
  return keys;
}

function sameMatchKeys(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((key, index) => key === right[index]);
}

/** Next Step 1 director keys, or null when the current selection should stay. */
export function nextIssuerRepMatchKeys(input: {
  snapshot: AuthorizedPartiesSnapshot | null | undefined;
  directors: IssuerDirectorOption[];
  currentKeys: string[];
  initialized: boolean;
  dirty: boolean;
}): string[] | null {
  if (input.dirty) return null;
  const fromSnapshot = issuerDirectorMatchKeysFromSnapshot(input.snapshot, input.directors);
  if (fromSnapshot.length > 0) {
    return sameMatchKeys(input.currentKeys, fromSnapshot) ? null : fromSnapshot;
  }
  if (!input.initialized && input.directors[0]) {
    const fallback = [input.directors[0].matchKey];
    return sameMatchKeys(input.currentKeys, fallback) ? null : fallback;
  }
  return null;
}

