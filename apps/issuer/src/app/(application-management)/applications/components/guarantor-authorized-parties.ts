import {
  findAuthorizedPartyForGuarantor,
  isValidSigningIcNumber,
  normalizeSigningEmail,
  normalizeSigningIcNumber,
  type AuthorizedPartiesSubmitPayload,
  type AuthorizedParty,
  type AuthorizedPartiesSnapshot,
  type AuthorizedPartyGuarantorLookup,
} from "@cashsouk/types";
import {
  buildIssuerAuthorizedPartiesSubmitPayload,
  type ApplicationGuarantorRow,
} from "./build-issuer-envelope-bindings";
import type { IssuerDirectorOption } from "./issuer-directors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CorporateRepDraft = {
  name: string;
  email: string;
  ic_number: string;
};

export type GuarantorPartyDrafts = {
  corporateRepsById: Record<string, CorporateRepDraft[]>;
  individualEmailsById: Record<string, string>;
};

export const EMPTY_CORPORATE_REP: CorporateRepDraft = {
  name: "",
  email: "",
  ic_number: "",
};

export function emptyGuarantorPartyDrafts(): GuarantorPartyDrafts {
  return { corporateRepsById: {}, individualEmailsById: {} };
}

export function isBlankCorporateRep(rep: CorporateRepDraft): boolean {
  return !rep.name.trim() && !rep.email.trim() && !rep.ic_number.trim();
}

function isValidPartyEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeSigningEmail(email));
}

export function isCompleteCorporateRep(rep: CorporateRepDraft): boolean {
  return (
    Boolean(rep.name.trim()) &&
    isValidPartyEmail(rep.email) &&
    isValidSigningIcNumber(rep.ic_number)
  );
}

function lookupFromRow(guarantor: ApplicationGuarantorRow): AuthorizedPartyGuarantorLookup {
  return {
    id: guarantor.id,
    client_guarantor_id: guarantor.client_guarantor_id ?? null,
    guarantor_type: guarantor.guarantor_type,
    name: guarantor.name,
    business_name: guarantor.business_name,
  };
}

function partyForGuarantor(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  guarantor: ApplicationGuarantorRow,
  all: ApplicationGuarantorRow[]
): AuthorizedParty | null {
  return findAuthorizedPartyForGuarantor(snapshot, lookupFromRow(guarantor), all.map(lookupFromRow));
}

function repsFromParty(party: AuthorizedParty | null): CorporateRepDraft[] | null {
  if (!party || party.entity_kind !== "CORPORATE_GUARANTOR" || party.representatives.length === 0) {
    return null;
  }
  return party.representatives.map((rep) => ({
    name: rep.name,
    email: rep.email,
    ic_number: normalizeSigningIcNumber(rep.ic_number),
  }));
}

function sameCorporateReps(left: CorporateRepDraft[], right: CorporateRepDraft[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (row, index) =>
        row.name === right[index]?.name &&
        row.email === right[index]?.email &&
        row.ic_number === right[index]?.ic_number
    )
  );
}

function sameDrafts(
  current: GuarantorPartyDrafts,
  next: GuarantorPartyDrafts,
  guarantors: ApplicationGuarantorRow[]
): boolean {
  for (const guarantor of guarantors) {
    if (guarantor.guarantor_type === "company") {
      if (
        !sameCorporateReps(
          current.corporateRepsById[guarantor.id] ?? [],
          next.corporateRepsById[guarantor.id] ?? []
        )
      ) {
        return false;
      }
    } else if (
      (current.individualEmailsById[guarantor.id] ?? "") !==
      (next.individualEmailsById[guarantor.id] ?? "")
    ) {
      return false;
    }
  }
  return true;
}

/** Next Step 1 guarantor drafts, or null when the current selection should stay. */
export function nextGuarantorPartyDrafts(input: {
  snapshot: AuthorizedPartiesSnapshot | null | undefined;
  guarantors: ApplicationGuarantorRow[];
  current: GuarantorPartyDrafts;
  dirty: boolean;
}): GuarantorPartyDrafts | null {
  if (input.dirty) return null;
  const corporateRepsById: Record<string, CorporateRepDraft[]> = {};
  const individualEmailsById: Record<string, string> = {};
  for (const guarantor of input.guarantors) {
    const party = partyForGuarantor(input.snapshot, guarantor, input.guarantors);
    if (guarantor.guarantor_type === "company") {
      corporateRepsById[guarantor.id] =
        repsFromParty(party) ??
        input.current.corporateRepsById[guarantor.id] ??
        [{ ...EMPTY_CORPORATE_REP }];
    } else {
      individualEmailsById[guarantor.id] =
        party?.representatives[0]?.email ||
        input.current.individualEmailsById[guarantor.id] ||
        guarantor.email;
    }
  }
  const next = { corporateRepsById, individualEmailsById };
  return sameDrafts(input.current, next, input.guarantors) ? null : next;
}

export function areGuarantorPartiesReady(
  guarantors: ApplicationGuarantorRow[],
  drafts: GuarantorPartyDrafts
): boolean {
  for (const guarantor of guarantors) {
    if (guarantor.guarantor_type === "company") {
      const filled = (drafts.corporateRepsById[guarantor.id] ?? []).filter(
        (rep) => !isBlankCorporateRep(rep)
      );
      if (filled.length === 0 || !filled.every(isCompleteCorporateRep)) return false;
    } else {
      const email = drafts.individualEmailsById[guarantor.id] ?? guarantor.email;
      if (!isValidPartyEmail(email)) return false;
      if (!String(guarantor.name ?? "").trim()) return false;
      if (!isValidSigningIcNumber(guarantor.ic_number)) return false;
    }
  }
  return true;
}

export function buildAuthorizedPartiesSubmitPayload(input: {
  directors: IssuerDirectorOption[];
  selectedMatchKeys: string[];
  guarantors: ApplicationGuarantorRow[];
  drafts: GuarantorPartyDrafts;
}): AuthorizedPartiesSubmitPayload {
  const issuer = buildIssuerAuthorizedPartiesSubmitPayload(
    input.directors,
    input.selectedMatchKeys
  );
  const guarantorParties: AuthorizedParty[] = [];
  for (const guarantor of input.guarantors) {
    if (guarantor.guarantor_type === "company") {
      const representatives = (input.drafts.corporateRepsById[guarantor.id] ?? [])
        .filter((rep) => !isBlankCorporateRep(rep))
        .map((rep) => ({
          name: rep.name.trim(),
          email: normalizeSigningEmail(rep.email),
          ic_number: normalizeSigningIcNumber(rep.ic_number),
          capacity: "authorised_signatory" as const,
        }));
      guarantorParties.push({
        key: guarantor.client_guarantor_id || guarantor.id,
        entity_kind: "CORPORATE_GUARANTOR",
        application_guarantor_id: guarantor.id,
        ...(guarantor.client_guarantor_id
          ? { client_guarantor_id: guarantor.client_guarantor_id }
          : {}),
        representatives,
      });
      continue;
    }
    guarantorParties.push({
      key: guarantor.client_guarantor_id || guarantor.id,
      entity_kind: "INDIVIDUAL_GUARANTOR",
      application_guarantor_id: guarantor.id,
      ...(guarantor.client_guarantor_id
        ? { client_guarantor_id: guarantor.client_guarantor_id }
        : {}),
      representatives: [
        {
          name: String(guarantor.name ?? "").trim(),
          email: normalizeSigningEmail(
            input.drafts.individualEmailsById[guarantor.id] ?? guarantor.email
          ),
          ic_number: normalizeSigningIcNumber(String(guarantor.ic_number ?? "")),
          capacity: "authorised_signatory",
        },
      ],
    });
  }
  return { parties: [...issuer.parties, ...guarantorParties] };
}
