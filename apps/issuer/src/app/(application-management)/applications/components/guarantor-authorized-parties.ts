import {
  isValidSigningIcNumber,
  normalizeSigningEmail,
  normalizeSigningIcNumber,
  type AuthorizedPartiesSubmitPayload,
  type AuthorizedParty,
  type AuthorizedPartiesSnapshot,
  type AuthorizedRepresentativeCapacity,
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
  capacity: AuthorizedRepresentativeCapacity;
};

export type GuarantorPartyDrafts = {
  corporateRepsById: Record<string, CorporateRepDraft[]>;
  individualEmailsById: Record<string, string>;
};

export const EMPTY_CORPORATE_REP: CorporateRepDraft = {
  name: "",
  email: "",
  ic_number: "",
  capacity: "authorised_signatory",
};

export function emptyGuarantorPartyDrafts(): GuarantorPartyDrafts {
  return { corporateRepsById: {}, individualEmailsById: {} };
}

export function isBlankCorporateRep(rep: CorporateRepDraft): boolean {
  return (
    !rep.name.trim() &&
    !rep.email.trim() &&
    normalizeSigningIcNumber(rep.ic_number).length === 0
  );
}

function isValidPartyEmail(email: string): boolean {
  return EMAIL_RE.test(normalizeSigningEmail(email));
}

export function isCompleteCorporateRep(rep: CorporateRepDraft): boolean {
  return (
    Boolean(rep.name.trim()) &&
    isValidPartyEmail(rep.email) &&
    isValidSigningIcNumber(rep.ic_number) &&
    (rep.capacity === "director" || rep.capacity === "authorised_signatory")
  );
}

function repsFromSnapshot(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  guarantorId: string
): CorporateRepDraft[] | null {
  const party = snapshot?.parties.find(
    (item) =>
      item.entity_kind === "CORPORATE_GUARANTOR" && item.application_guarantor_id === guarantorId
  );
  if (!party || party.representatives.length === 0) return null;
  return party.representatives.map((rep) => ({
    name: rep.name,
    email: rep.email,
    ic_number: rep.ic_number,
    capacity: rep.capacity,
  }));
}

function individualEmailFromSnapshot(
  snapshot: AuthorizedPartiesSnapshot | null | undefined,
  guarantorId: string
): string | null {
  const party = snapshot?.parties.find(
    (item) =>
      item.entity_kind === "INDIVIDUAL_GUARANTOR" && item.application_guarantor_id === guarantorId
  );
  const email = party?.representatives[0]?.email;
  return email ? email : null;
}

function sameCorporateReps(left: CorporateRepDraft[], right: CorporateRepDraft[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (row, index) =>
        row.name === right[index]?.name &&
        row.email === right[index]?.email &&
        row.ic_number === right[index]?.ic_number &&
        row.capacity === right[index]?.capacity
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
    if (guarantor.guarantor_type === "company") {
      corporateRepsById[guarantor.id] =
        repsFromSnapshot(input.snapshot, guarantor.id) ??
        input.current.corporateRepsById[guarantor.id] ??
        [{ ...EMPTY_CORPORATE_REP }];
    } else {
      individualEmailsById[guarantor.id] =
        individualEmailFromSnapshot(input.snapshot, guarantor.id) ??
        input.current.individualEmailsById[guarantor.id] ??
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
          capacity: rep.capacity,
        }));
      guarantorParties.push({
        key: guarantor.id,
        entity_kind: "CORPORATE_GUARANTOR",
        application_guarantor_id: guarantor.id,
        representatives,
      });
      continue;
    }
    guarantorParties.push({
      key: guarantor.id,
      entity_kind: "INDIVIDUAL_GUARANTOR",
      application_guarantor_id: guarantor.id,
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
