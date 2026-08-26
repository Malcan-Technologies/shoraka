import {
  AUTHORIZED_PARTY_ISSUER_KEY,
  getIssuerAuthorizedParty,
  guarantorBindingsFromSnapshot,
  issuerDirectorBindingsFromSnapshot,
  type AuthorizedPartiesSnapshot,
  type AuthorizedPartiesSubmitPayload,
  type RecipientBinding,
  type SigningTemplateConfig,
  type SigningTemplateRole,
} from "@cashsouk/types";
import {
  isDirectorRole,
  issuerDirectorsFromOrganization,
  type IssuerDirectorOption,
} from "./issuer-directors";

export type ApplicationGuarantorRow = {
  id: string;
  client_guarantor_id?: string | null;
  guarantor_type: "individual" | "company";
  name?: string | null;
  business_name?: string | null;
  email: string;
  ic_number?: string | null;
};

export function isGuarantorRole(role: SigningTemplateRole): boolean {
  return role.key === "guarantor" || role.source_hint === "guarantor";
}

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

function buildFallbackBinding(
  role: SigningTemplateRole,
  activeOrganization: unknown,
  directors: IssuerDirectorOption[]
): RecipientBinding {
  const director = directors[0];
  if (director) {
    return {
      role_key: role.key,
      name: director.name,
      email: director.email,
      ic_number: director.ic_number,
    };
  }
  const org = activeOrganization as
    | {
        name?: string | null;
        firstName?: string | null;
        lastName?: string | null;
        members?: Array<{ email?: string; firstName?: string; lastName?: string }>;
      }
    | null
    | undefined;
  const member = org?.members?.[0];
  const fallbackName =
    [member?.firstName, member?.lastName].filter(Boolean).join(" ").trim() ||
    [org?.firstName, org?.lastName].filter(Boolean).join(" ").trim() ||
    org?.name ||
    role.label ||
    "Issuer signer";
  return {
    role_key: role.key,
    name: fallbackName,
    email: member?.email ?? "",
    ic_number: "",
  };
}

function overlaySnapshotDirectors(
  snapshotBindings: RecipientBinding[],
  directors: IssuerDirectorOption[]
): RecipientBinding[] {
  return snapshotBindings.map((binding) => {
    const director =
      directors.find(
        (item) =>
          item.email.trim().toLowerCase() === binding.email.trim().toLowerCase()
      ) ??
      directors.find((item) => item.name.trim() === binding.name.trim());
    if (!director) return binding;
    return {
      ...binding,
      name: director.name,
      email: director.email,
      ic_number: director.ic_number ?? binding.ic_number,
    };
  });
}

export function buildIssuerEnvelopeBindings(
  template: SigningTemplateConfig,
  activeOrganization: unknown,
  applicationGuarantors: ApplicationGuarantorRow[] = [],
  authorizedParties?: AuthorizedPartiesSnapshot | null
): RecipientBinding[] {
  const directors = issuerDirectorsFromOrganization(activeOrganization);
  const guarantorRows = guarantorsFromApplication(applicationGuarantors);
  const bindings: RecipientBinding[] = [];

  for (const role of template.roles) {
    const preferredCount = Math.max(role.min_count, 1);
    const snapshotDirectorBindings = isDirectorRole(role)
      ? overlaySnapshotDirectors(
          issuerDirectorBindingsFromSnapshot(authorizedParties, role.key),
          directors
        )
      : [];
    const snapshotGuarantorBindings = isGuarantorRole(role)
      ? guarantorBindingsFromSnapshot(authorizedParties, role.key)
      : [];
    let roleBindings: RecipientBinding[];
    if (isDirectorRole(role) && snapshotDirectorBindings.length > 0) {
      roleBindings = snapshotDirectorBindings;
    } else if (isDirectorRole(role) && directors.length > 0) {
      roleBindings = directors.slice(0, preferredCount).map((director) => ({
        role_key: role.key,
        name: director.name,
        email: director.email,
        ic_number: director.ic_number,
      }));
    } else if (isGuarantorRole(role) && snapshotGuarantorBindings.length > 0) {
      roleBindings = snapshotGuarantorBindings;
    } else if (isGuarantorRole(role) && guarantorRows.length > 0) {
      const maxRows = role.max_count ?? guarantorRows.length;
      roleBindings = guarantorRows.slice(0, maxRows).map((guarantor) => ({
        role_key: role.key,
        name: guarantor.guarantor_type === "company" ? "" : (guarantor.name ?? ""),
        email: guarantor.email,
        ic_number: null,
        application_guarantor_id: guarantor.id,
      }));
    } else {
      roleBindings = [buildFallbackBinding(role, activeOrganization, directors)];
    }
    const limited: RecipientBinding[] =
      role.max_count != null ? roleBindings.slice(0, role.max_count) : roleBindings;
    while (limited.length < role.min_count) {
      limited.push(buildFallbackBinding(role, activeOrganization, directors));
    }
    bindings.push(...limited);
  }

  return bindings;
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
