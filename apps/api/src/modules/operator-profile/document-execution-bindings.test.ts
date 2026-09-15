import { AppError } from "../../lib/http/error-handler";
import type { OperatorSigningRole } from "@cashsouk/types";
import { allDocumentExecutionSlots } from "@cashsouk/types";

jest.mock("../../lib/prisma", () => ({ prisma: {} }));
jest.mock("../../lib/s3/client", () => ({ generatePresignedUploadUrl: jest.fn() }));

import {
  assertEligibleDocumentExecutionPerson,
  buildDocumentExecutionBindingRows,
  rethrowSigningPersonUniqueConflict,
} from "./service";

const HASH = "aa".repeat(32);
const CONFIRMED_AT = new Date("2026-09-11T00:00:00.000Z");

const SIGNATORY_A = {
  id: "sp_a",
  active: true,
  roles: ["AUTHORISED_SIGNATORY"] as OperatorSigningRole[],
  signing_email: "aisha@cashsouk.com",
  signature_s3_key: "operator-profile/signing-signatures/a.png",
  signature_sha256: HASH,
  signature_confirmed_at: CONFIRMED_AT,
  officerName: "Aisha Rahman",
  designation: "Chief Executive Officer",
  identityNumber: "850101015555",
};
const SIGNATORY_B = {
  id: "sp_b",
  active: true,
  roles: ["AUTHORISED_SIGNATORY", "WITNESS"] as OperatorSigningRole[],
  signing_email: "ben@cashsouk.com",
  signature_s3_key: "operator-profile/signing-signatures/b.png",
  signature_sha256: HASH,
  signature_confirmed_at: CONFIRMED_AT,
  officerName: "Ben Tan",
  designation: "Director",
  identityNumber: "860202025555",
};
const UNSIGNED = {
  id: "sp_u",
  active: true,
  roles: ["AUTHORISED_SIGNATORY"] as OperatorSigningRole[],
  signing_email: "unsigned@cashsouk.com",
  signature_s3_key: null,
  signature_sha256: null,
  signature_confirmed_at: null,
  officerName: "Unsigned",
  designation: "Director",
  identityNumber: "870303035555",
};
const WITNESS_ONLY = {
  id: "sp_w",
  active: true,
  roles: ["WITNESS"] as OperatorSigningRole[],
  signing_email: "witness@cashsouk.com",
  signature_s3_key: "operator-profile/signing-signatures/w.png",
  signature_sha256: HASH,
  signature_confirmed_at: CONFIRMED_AT,
  officerName: "Chloe Lim",
  designation: "Manager",
  identityNumber: "880404045555",
};
const INACTIVE = {
  id: "sp_i",
  active: false,
  roles: ["AUTHORISED_SIGNATORY"] as OperatorSigningRole[],
  signing_email: "idle@cashsouk.com",
  signature_s3_key: "operator-profile/signing-signatures/i.png",
  signature_sha256: HASH,
  signature_confirmed_at: CONFIRMED_AT,
  officerName: "Idle",
  designation: "Director",
  identityNumber: "890505055555",
};

function emptyBindings(overrides: Record<string, { signingPersonId: string | null }> = {}) {
  return allDocumentExecutionSlots().map((slot) => {
    const key = `${slot.roleKey}:${slot.slotIndex}`;
    return {
      roleKey: slot.roleKey,
      slotIndex: slot.slotIndex,
      signingPersonId: overrides[key]?.signingPersonId ?? null,
    };
  });
}

function expectAppError(run: () => void, code: string, messagePart: string): void {
  try {
    run();
    throw new Error("expected AppError");
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    expect((error as AppError).message).toContain(messagePart);
  }
}

describe("document execution binding eligibility", () => {
  it("rejects an inactive person", () => {
    expectAppError(
      () => assertEligibleDocumentExecutionPerson(INACTIVE),
      "VALIDATION_ERROR",
      "active Authorised Signatory"
    );
  });

  it("rejects a witness-only person for authorised representative roles", () => {
    expectAppError(
      () => assertEligibleDocumentExecutionPerson(WITNESS_ONLY),
      "VALIDATION_ERROR",
      "Witness-only"
    );
  });

  it("allows a witness-only person for witness roles", () => {
    expect(() => assertEligibleDocumentExecutionPerson(WITNESS_ONLY, "WITNESS")).not.toThrow();
  });

  it("allows an active Authorised Signatory who is also a Witness", () => {
    expect(() => assertEligibleDocumentExecutionPerson(SIGNATORY_B)).not.toThrow();
  });
});

describe("buildDocumentExecutionBindingRows", () => {
  const people = [SIGNATORY_A, SIGNATORY_B, UNSIGNED, WITNESS_ONLY, INACTIVE];

  it("clears unassigned roles and keeps complete representative pairs", () => {
    const rows = buildDocumentExecutionBindingRows({
      operatorProfileId: "op_1",
      people,
      bindings: emptyBindings({
        "FA_INVESTOR:1": { signingPersonId: SIGNATORY_A.id },
        "FA_INVESTOR:2": { signingPersonId: SIGNATORY_B.id },
      }),
    });
    expect(rows).toEqual([
      {
        operator_profile_id: "op_1",
        role_key: "FA_INVESTOR",
        slot_index: 1,
        signing_person_id: SIGNATORY_A.id,
      },
      {
        operator_profile_id: "op_1",
        role_key: "FA_INVESTOR",
        slot_index: 2,
        signing_person_id: SIGNATORY_B.id,
      },
    ]);
  });

  it("rejects assigning only one representative in a pair", () => {
    expectAppError(
      () =>
        buildDocumentExecutionBindingRows({
          operatorProfileId: "op_1",
          people,
          bindings: emptyBindings({
            "FA_INVESTOR:1": { signingPersonId: SIGNATORY_A.id },
          }),
        }),
      "SIGNING_AUTOMATIC_ROLE_UNBOUND",
      "both representatives"
    );
  });

  it("rejects assigning the same person to both Investor representatives", () => {
    expectAppError(
      () =>
        buildDocumentExecutionBindingRows({
          operatorProfileId: "op_1",
          people,
          bindings: emptyBindings({
            "FA_INVESTOR:1": { signingPersonId: SIGNATORY_A.id },
            "FA_INVESTOR:2": { signingPersonId: SIGNATORY_A.id },
          }),
        }),
      "DOCUMENT_EXECUTION_DUPLICATE_SIGNER",
      "two different people"
    );
  });

  it("rejects the same signing email on both Investor representatives", () => {
    expectAppError(
      () =>
        buildDocumentExecutionBindingRows({
          operatorProfileId: "op_1",
          people: [
            SIGNATORY_A,
            { ...SIGNATORY_B, signing_email: "aisha@cashsouk.com" },
            UNSIGNED,
            WITNESS_ONLY,
            INACTIVE,
          ],
          bindings: emptyBindings({
            "FA_INVESTOR:1": { signingPersonId: SIGNATORY_A.id },
            "FA_INVESTOR:2": { signingPersonId: SIGNATORY_B.id },
          }),
        }),
      "DOCUMENT_EXECUTION_EMAIL_COLLISION",
      "same signing email"
    );
  });

  it("allows the same pair on Investor, Agent, JSG, and DoA, and a witness on issuer rows", () => {
    const rows = buildDocumentExecutionBindingRows({
      operatorProfileId: "op_1",
      people,
      bindings: emptyBindings({
        "FA_INVESTOR:1": { signingPersonId: SIGNATORY_A.id },
        "FA_INVESTOR:2": { signingPersonId: SIGNATORY_B.id },
        "FA_AGENT:1": { signingPersonId: SIGNATORY_A.id },
        "FA_AGENT:2": { signingPersonId: SIGNATORY_B.id },
        "JSG_OPERATOR:1": { signingPersonId: SIGNATORY_A.id },
        "JSG_OPERATOR:2": { signingPersonId: SIGNATORY_B.id },
        "DOA_SSP:1": { signingPersonId: SIGNATORY_A.id },
        "DOA_SSP:2": { signingPersonId: SIGNATORY_B.id },
        "FA_ISSUER_WITNESS:1": { signingPersonId: WITNESS_ONLY.id },
      }),
    });
    expect(rows).toHaveLength(9);
    expect(rows.filter((row) => row.signing_person_id === SIGNATORY_A.id)).toHaveLength(4);
  });

  it("rejects a witness-only assignment to a representative role", () => {
    expectAppError(
      () =>
        buildDocumentExecutionBindingRows({
          operatorProfileId: "op_1",
          people,
          bindings: emptyBindings({
            "DOA_SSP:1": { signingPersonId: WITNESS_ONLY.id },
            "DOA_SSP:2": { signingPersonId: SIGNATORY_A.id },
          }),
        }),
      "VALIDATION_ERROR",
      "Witness-only"
    );
  });

  it("rejects an inactive assignment", () => {
    expectAppError(
      () =>
        buildDocumentExecutionBindingRows({
          operatorProfileId: "op_1",
          people,
          bindings: emptyBindings({
            "DOA_SSP:1": { signingPersonId: INACTIVE.id },
            "DOA_SSP:2": { signingPersonId: SIGNATORY_A.id },
          }),
        }),
      "VALIDATION_ERROR",
      "active Authorised Signatory"
    );
  });

  it("rejects a bound person who has no confirmed signature", () => {
    expectAppError(
      () =>
        buildDocumentExecutionBindingRows({
          operatorProfileId: "op_1",
          people,
          bindings: emptyBindings({
            "JSG_OPERATOR:1": { signingPersonId: UNSIGNED.id },
            "JSG_OPERATOR:2": { signingPersonId: SIGNATORY_A.id },
          }),
        }),
      "SIGNING_AUTOMATIC_SIGNER_NOT_READY",
      "confirmed signature"
    );
  });
});

describe("signing email unique conflicts", () => {
  it("maps a signing_email unique conflict to a clear error", () => {
    expectAppError(
      () =>
        rethrowSigningPersonUniqueConflict({
          code: "P2002",
          meta: { target: ["signing_email"] },
        }),
      "SIGNING_EMAIL_TAKEN",
      "already used"
    );
  });

  it("keeps the existing person-exists error for other unique conflicts", () => {
    expectAppError(
      () =>
        rethrowSigningPersonUniqueConflict({
          code: "P2002",
          meta: { target: ["officer_id"] },
        }),
      "SIGNING_PERSON_EXISTS",
      "already has a signing configuration"
    );
  });
});
