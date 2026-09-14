import {
  automaticSignerRef,
  automaticSigningKeywordForSlot,
  automaticSignerKeywordPair,
  automaticSignerKeywordCollisionIssue,
  automaticSigningKeywordsOverlap,
  automaticContractKeywordLimitIssue,
  automaticContractKeywords,
  configuredSlotsForPackageKey,
  defaultAutomaticKeywordOwners,
  documentExecutionBindingIssues,
  documentExecutionRolesForPackageKey,
  documentExecutionSlotCount,
  documentExecutionSlotsForPackageKey,
  emptyDocumentExecutionSlots,
  executionRoleHasSignDate,
  executionRoleSigningRole,
  frozenExecutionMergePerson,
  frozenPersonForRole,
  isAutomaticSignerProviderReady,
  isOperatorDocumentExecutionRole,
  isOperatorDocumentWitnessRole,
  parseFrozenAutomaticSignerSnapshot,
  placementsForPackageKey,
  signingPackageRequiresDoaStamp,
  signingPackageRequiresIssuerSeal,
  witnessRepeatCount,
  OPERATOR_DOCUMENT_EXECUTION_KEYWORDS,
  OPERATOR_DOCUMENT_EXECUTION_ROLES,
  OPERATOR_DOCUMENT_REPRESENTATIVE_COUNT,
  SIGNING_PACKAGE_DOCUMENT_EXECUTION_ROLES,
} from "./operator-document-execution";
import { FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY } from "./generated-documents";
import {
  DEED_OF_ASSIGNMENT_TEMPLATE_KEY,
  GUARANTOR_AGREEMENT_TEMPLATE_KEY,
} from "./signing-envelopes";

describe("operator document execution roles", () => {
  it("maps each signing-package document to independent representative and witness roles", () => {
    expect(documentExecutionRolesForPackageKey(FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY)).toEqual([
      "FA_INVESTOR",
      "FA_AGENT",
      "FA_ISSUER_WITNESS",
    ]);
    expect(documentExecutionRolesForPackageKey(GUARANTOR_AGREEMENT_TEMPLATE_KEY)).toEqual([
      "JSG_OPERATOR",
      "JSG_GUARANTOR_WITNESS",
      "JSG_OPERATOR_WITNESS",
    ]);
    expect(documentExecutionRolesForPackageKey(DEED_OF_ASSIGNMENT_TEMPLATE_KEY)).toEqual([
      "DOA_SSP",
      "DOA_ASSIGNOR_WITNESS",
    ]);
    expect(documentExecutionRolesForPackageKey("offer_letter")).toEqual([]);
    expect(SIGNING_PACKAGE_DOCUMENT_EXECUTION_ROLES.facility_agreement).toEqual([
      "FA_INVESTOR",
      "FA_AGENT",
      "FA_ISSUER_WITNESS",
    ]);
  });

  it("configures two people per representative role and one reusable witness per section", () => {
    expect(configuredSlotsForPackageKey("facility_agreement")).toEqual([
      { roleKey: "FA_INVESTOR", slotIndex: 1 },
      { roleKey: "FA_INVESTOR", slotIndex: 2 },
      { roleKey: "FA_AGENT", slotIndex: 1 },
      { roleKey: "FA_AGENT", slotIndex: 2 },
      { roleKey: "FA_ISSUER_WITNESS", slotIndex: 1 },
    ]);
    expect(documentExecutionSlotsForPackageKey("guarantor_agreement")).toEqual([
      { roleKey: "JSG_OPERATOR", slotIndex: 1 },
      { roleKey: "JSG_OPERATOR", slotIndex: 2 },
      { roleKey: "JSG_GUARANTOR_WITNESS", slotIndex: 1 },
      { roleKey: "JSG_OPERATOR_WITNESS", slotIndex: 1 },
    ]);
    expect(documentExecutionSlotsForPackageKey("deed_of_assignment")).toEqual([
      { roleKey: "DOA_SSP", slotIndex: 1 },
      { roleKey: "DOA_SSP", slotIndex: 2 },
      { roleKey: "DOA_ASSIGNOR_WITNESS", slotIndex: 1 },
    ]);
    expect(
      emptyDocumentExecutionSlots("CashSouk").map((row) => [row.roleKey, row.slotIndex])
    ).toEqual([
      ["FA_INVESTOR", 1],
      ["FA_INVESTOR", 2],
      ["FA_AGENT", 1],
      ["FA_AGENT", 2],
      ["JSG_OPERATOR", 1],
      ["JSG_OPERATOR", 2],
      ["DOA_SSP", 1],
      ["DOA_SSP", 2],
      ["FA_ISSUER_WITNESS", 1],
      ["JSG_GUARANTOR_WITNESS", 1],
      ["JSG_OPERATOR_WITNESS", 1],
      ["DOA_ASSIGNOR_WITNESS", 1],
    ]);
    expect(documentExecutionSlotCount("JSG_OPERATOR")).toBe(OPERATOR_DOCUMENT_REPRESENTATIVE_COUNT);
    expect(documentExecutionSlotCount("FA_ISSUER_WITNESS")).toBe(1);
    expect(executionRoleSigningRole("FA_INVESTOR")).toBe("AUTHORISED_SIGNATORY");
    expect(executionRoleSigningRole("FA_ISSUER_WITNESS")).toBe("WITNESS");
  });

  it("expands repeated witness placements from document party counts", () => {
    expect(
      documentExecutionSlotsForPackageKey("facility_agreement", {
        issuerSignatoryCount: 3,
        jsgGuarantorSignatureCount: 1,
        assignorSignatoryCount: 1,
      }).filter((slot) => slot.roleKey === "FA_ISSUER_WITNESS")
    ).toEqual([
      { roleKey: "FA_ISSUER_WITNESS", slotIndex: 1 },
      { roleKey: "FA_ISSUER_WITNESS", slotIndex: 2 },
      { roleKey: "FA_ISSUER_WITNESS", slotIndex: 3 },
    ]);
    expect(
      witnessRepeatCount("JSG_GUARANTOR_WITNESS", {
        issuerSignatoryCount: 1,
        jsgGuarantorSignatureCount: 4,
        assignorSignatoryCount: 1,
      })
    ).toBe(4);
    expect(
      placementsForPackageKey("deed_of_assignment", {
        issuerSignatoryCount: 1,
        jsgGuarantorSignatureCount: 1,
        assignorSignatoryCount: 2,
      })
        .filter((row) => row.roleKey === "DOA_ASSIGNOR_WITNESS")
        .map((row) => row.keyword)
    ).toEqual(["CASHSOUK_DOA_ASSIGNOR_WITNESS_1", "CASHSOUK_DOA_ASSIGNOR_WITNESS_2"]);
  });

  it("requires an issuer seal only when FA or DOA is in the package, and a CashSouk stamp for DoA", () => {
    expect(signingPackageRequiresIssuerSeal(["guarantor_agreement"])).toBe(false);
    expect(signingPackageRequiresIssuerSeal(["facility_agreement"])).toBe(true);
    expect(signingPackageRequiresDoaStamp(["facility_agreement"])).toBe(false);
    expect(signingPackageRequiresDoaStamp(["deed_of_assignment", "guarantor_agreement"])).toBe(true);
  });

  it("uses a unique keyword per automatic placement and dates only where the template has a Date line", () => {
    const keywords = [
      automaticSigningKeywordForSlot("FA_INVESTOR", 1),
      automaticSigningKeywordForSlot("FA_AGENT", 2),
      automaticSigningKeywordForSlot("JSG_OPERATOR", 1),
      automaticSigningKeywordForSlot("DOA_SSP", 2),
      automaticSigningKeywordForSlot("FA_ISSUER_WITNESS", 1),
      automaticSigningKeywordForSlot("JSG_GUARANTOR_WITNESS", 3),
      automaticSigningKeywordForSlot("JSG_OPERATOR_WITNESS", 1),
      automaticSigningKeywordForSlot("DOA_ASSIGNOR_WITNESS", 2),
    ];
    expect(new Set(keywords).size).toBe(keywords.length);
    expect(keywords.every((keyword) => keyword.startsWith("CASHSOUK_"))).toBe(true);
    expect(automaticSigningKeywordForSlot("JSG_OPERATOR", 1)).toBe(
      `${OPERATOR_DOCUMENT_EXECUTION_KEYWORDS.JSG_OPERATOR}_1`
    );
    expect(OPERATOR_DOCUMENT_EXECUTION_ROLES).toHaveLength(8);
    expect(automaticSignerRef("FA", "sp-1")).toBe("auto:FA:sp-1");
    expect(executionRoleHasSignDate("FA_INVESTOR")).toBe(true);
    expect(executionRoleHasSignDate("FA_ISSUER_WITNESS")).toBe(true);
    expect(executionRoleHasSignDate("JSG_GUARANTOR_WITNESS")).toBe(true);
    expect(executionRoleHasSignDate("JSG_OPERATOR")).toBe(false);
    expect(executionRoleHasSignDate("DOA_SSP")).toBe(false);
    expect(executionRoleHasSignDate("JSG_OPERATOR_WITNESS")).toBe(false);
    expect(executionRoleHasSignDate("DOA_ASSIGNOR_WITNESS")).toBe(false);
  });

  it("reuses one sign/date keyword pair per person and stays within the contract limit", () => {
    const shared = automaticSignerKeywordPair("FA", "sp-aisha", [
      { roleKey: "FA_INVESTOR" },
      { roleKey: "FA_AGENT" },
    ]);
    expect(shared).toEqual({
      signKeyword: "CASHSOUK_FA_SPAISHA_SIGN",
      dateKeyword: "CASHSOUK_FA_SPAISHA_DATE",
    });
    expect(automaticSigningKeywordsOverlap(shared.signKeyword, shared.dateKeyword!)).toBe(false);
    expect(
      automaticSignerKeywordCollisionIssue([
        {
          signKeyword: "CASHSOUK_FA_SPAISHA",
          dateKeyword: "CASHSOUK_FA_SPAISHA_DATE",
          placements: [{ roleKey: "FA_INVESTOR", slotIndex: 1 }],
        },
      ])
    ).toMatch(/overlap/);
    expect(
      automaticSignerKeywordPair("JSG", "sp-operator", [{ roleKey: "JSG_OPERATOR" }])
    ).toEqual({ signKeyword: "CASHSOUK_JSG_SPOPERATOR_SIGN" });
    expect(
      automaticSignerKeywordPair("DOA", "sp-witness", [{ roleKey: "DOA_ASSIGNOR_WITNESS" }])
    ).toEqual({ signKeyword: "CASHSOUK_DOA_SPWITNESS_SIGN" });
    expect(
      automaticSignerKeywordPair("JSG", "sp-witness", [{ roleKey: "JSG_OPERATOR_WITNESS" }])
    ).toEqual({ signKeyword: "CASHSOUK_JSG_SPWITNESS_SIGN" });
    const faOwners = defaultAutomaticKeywordOwners("facility_agreement", {
      issuerSignatoryCount: 2,
      jsgGuarantorSignatureCount: 1,
      assignorSignatoryCount: 1,
    });
    expect(faOwners.some((owner) => owner.placements.length === 2)).toBe(true);
    expect(automaticContractKeywordLimitIssue(faOwners)).toBeNull();
    expect(automaticContractKeywords(faOwners)).toHaveLength(10);
  });

  it("does not treat a generic Authorised Signatory as a document binding", () => {
    expect(isOperatorDocumentExecutionRole("AUTHORISED_SIGNATORY")).toBe(false);
    expect(isOperatorDocumentWitnessRole("FA_ISSUER_WITNESS")).toBe(true);
    expect(
      emptyDocumentExecutionSlots("CashSouk Sdn Bhd").every((row) => row.signingPersonId === null)
    ).toBe(true);
  });

  it("reports missing, not-ready, identity, duplicate, and email-colliding representative pairs", () => {
    const required = configuredSlotsForPackageKey("facility_agreement").filter(
      (slot) => slot.roleKey === "FA_INVESTOR"
    );
    expect(
      documentExecutionBindingIssues({
        requiredSlots: required,
        bindings: [
          {
            roleKey: "FA_INVESTOR",
            slotIndex: 1,
            signingPersonId: "sp-a",
            signingEmail: "a@cashsouk.com",
            officerName: "Aisha",
            designation: "Chief Executive Officer",
            identityNumber: "800101011234",
            providerReady: true,
          },
        ],
      }).map((issue) => issue.code)
    ).toEqual(["SIGNING_AUTOMATIC_ROLE_UNBOUND"]);
    expect(
      documentExecutionBindingIssues({
        requiredSlots: required,
        bindings: [
          {
            roleKey: "FA_INVESTOR",
            slotIndex: 1,
            signingPersonId: "sp-a",
            signingEmail: "a@cashsouk.com",
            officerName: "Aisha",
            designation: "Chief Executive Officer",
            identityNumber: "800101011234",
            providerReady: true,
          },
          {
            roleKey: "FA_INVESTOR",
            slotIndex: 2,
            signingPersonId: "sp-a",
            signingEmail: "a@cashsouk.com",
            officerName: "Aisha",
            designation: null,
            identityNumber: "800101011234",
            providerReady: false,
          },
        ],
      }).map((issue) => [issue.code, issue.slotIndex])
    ).toEqual([
      ["SIGNING_AUTOMATIC_SIGNER_NOT_READY", 2],
      ["SIGNING_AUTOMATIC_IDENTITY_MISSING", 2],
      ["DOCUMENT_EXECUTION_DUPLICATE_SIGNER", 2],
      ["DOCUMENT_EXECUTION_EMAIL_COLLISION", 2],
    ]);
  });

  it("allows the same people on Investor and Agent, and the same email for a witness", () => {
    expect(
      documentExecutionBindingIssues({
        requiredSlots: configuredSlotsForPackageKey("facility_agreement"),
        bindings: [
          {
            roleKey: "FA_INVESTOR",
            slotIndex: 1,
            signingPersonId: "sp-a",
            signingEmail: "a@cashsouk.com",
            officerName: "Aisha",
            designation: "Chief Executive Officer",
            identityNumber: "800101011234",
            providerReady: true,
          },
          {
            roleKey: "FA_INVESTOR",
            slotIndex: 2,
            signingPersonId: "sp-b",
            signingEmail: "b@cashsouk.com",
            officerName: "Ben",
            designation: "Director – Executive",
            identityNumber: "900101011234",
            providerReady: true,
          },
          {
            roleKey: "FA_AGENT",
            slotIndex: 1,
            signingPersonId: "sp-a",
            signingEmail: "a@cashsouk.com",
            officerName: "Aisha",
            designation: "Chief Executive Officer",
            identityNumber: "800101011234",
            providerReady: true,
          },
          {
            roleKey: "FA_AGENT",
            slotIndex: 2,
            signingPersonId: "sp-b",
            signingEmail: "b@cashsouk.com",
            officerName: "Ben",
            designation: "Director – Executive",
            identityNumber: "900101011234",
            providerReady: true,
          },
          {
            roleKey: "FA_ISSUER_WITNESS",
            slotIndex: 1,
            signingPersonId: "sp-a",
            signingEmail: "a@cashsouk.com",
            officerName: "Aisha",
            designation: "Chief Executive Officer",
            identityNumber: "800101011234",
            providerReady: true,
          },
        ],
      })
    ).toEqual([]);
  });

  it("requires a confirmed signature and the matching execution role", () => {
    const base = {
      active: true,
      roles: ["AUTHORISED_SIGNATORY"] as const,
      signingEmail: "a@cashsouk.com",
      signatureS3Key: "operator-profile/signing-signatures/a.png",
      signatureSha256: "abc",
      signatureConfirmedAt: "2026-09-11T00:00:00.000Z",
    };
    expect(isAutomaticSignerProviderReady(base)).toBe(true);
    expect(isAutomaticSignerProviderReady({ ...base, roles: ["WITNESS"] })).toBe(false);
    expect(
      isAutomaticSignerProviderReady({ ...base, roles: ["WITNESS"], requiredRole: "WITNESS" })
    ).toBe(true);
    expect(isAutomaticSignerProviderReady({ ...base, signatureConfirmedAt: null })).toBe(false);
    expect(isAutomaticSignerProviderReady({ ...base, signingEmail: " " })).toBe(false);
    expect(isAutomaticSignerProviderReady({ ...base, active: false })).toBe(false);
  });

  it("parses a frozen automatic signer snapshot with identity data and mixed placements", () => {
    const snapshot = {
      documentKind: "FA",
      legalEntityLabel: "CashSouk Sdn Bhd",
      signingPersonId: "sp-1",
      officerName: "Aisha Rahman",
      designation: "Chief Executive Officer",
      identityNumber: "800101011234",
      signingEmail: "aisha@cashsouk.com",
      signatureS3Key: "operator-profile/signing-signatures/a.png",
      signatureSha256: "abc123",
      signatureWidthPx: 80,
      signatureHeightPx: 40,
      signatureByteSize: 1200,
      placements: [
        {
          roleKey: "FA_INVESTOR",
          slotIndex: 1,
          keyword: "CASHSOUK_FA_INVESTOR_1",
          status: "PENDING",
        },
        {
          roleKey: "FA_AGENT",
          slotIndex: 1,
          keyword: "CASHSOUK_FA_AGENT_1",
          status: "SIGNED",
        },
        {
          roleKey: "FA_ISSUER_WITNESS",
          slotIndex: 1,
          keyword: "CASHSOUK_FA_ISSUER_WITNESS_1",
          status: "PENDING",
        },
      ],
    };
    const parsed = parseFrozenAutomaticSignerSnapshot(snapshot);
    expect(parsed?.identityNumber).toBe("800101011234");
    expect(parsed?.signKeyword).toBe("CASHSOUK_FA_SP1_SIGN");
    expect(parsed?.dateKeyword).toBe("CASHSOUK_FA_SP1_DATE");
    expect(parsed?.placements.map((row) => [row.keyword, row.status])).toEqual([
      ["CASHSOUK_FA_INVESTOR_1", "PENDING"],
      ["CASHSOUK_FA_AGENT_1", "SIGNED"],
      ["CASHSOUK_FA_ISSUER_WITNESS_1", "PENDING"],
    ]);
    expect(
      parseFrozenAutomaticSignerSnapshot({
        ...snapshot,
        signKeyword: "CASHSOUK_FA_SPAISHA_SIGN",
        dateKeyword: "CASHSOUK_FA_SPAISHA_DATE",
        placements: snapshot.placements.map((placement) => ({
          ...placement,
          keyword: "CASHSOUK_FA_SPAISHA_SIGN",
        })),
      })?.signKeyword
    ).toBe("CASHSOUK_FA_SPAISHA_SIGN");
    expect(
      parseFrozenAutomaticSignerSnapshot({
        ...snapshot,
        signKeyword: "CASHSOUK_FA_SPAISHA",
        dateKeyword: "CASHSOUK_FA_SPAISHA_DATE",
        placements: snapshot.placements.map((placement) => ({
          ...placement,
          keyword: "CASHSOUK_FA_SPAISHA",
        })),
      })?.signKeyword
    ).toBe("CASHSOUK_FA_SPAISHA");
    expect(frozenExecutionMergePerson([parsed!], "FA_INVESTOR", 1)).toEqual({
      name: "Aisha Rahman",
      designation: "Chief Executive Officer",
      identity_number: "800101011234",
    });
    expect(parseFrozenAutomaticSignerSnapshot({ ...snapshot, signatureWidthPx: 0 })).toBeNull();
    expect(
      parseFrozenAutomaticSignerSnapshot({
        roleKey: "JSG_OPERATOR",
        slotIndex: 1,
        keyword: "CASHSOUK_JSG_OPERATOR_1",
        legalEntityLabel: "CashSouk Sdn Bhd",
        signingPersonId: "sp-1",
        officerName: "Aisha Rahman",
        signingEmail: "aisha@cashsouk.com",
        signatureS3Key: "operator-profile/signing-signatures/a.png",
        signatureSha256: "abc123",
        signatureWidthPx: 80,
        signatureHeightPx: 40,
        signatureByteSize: 1200,
      })?.documentKind
    ).toBe("JSG");
    expect(
      parseFrozenAutomaticSignerSnapshot({
        documentKind: "FA",
        signerIndex: 2,
        legalEntityLabel: "CashSouk Sdn Bhd",
        signingPersonId: "sp-1",
        officerName: "Aisha Rahman",
        designation: "CHIEF_EXECUTIVE_OFFICER",
        signingEmail: "aisha@cashsouk.com",
        signatureS3Key: "operator-profile/signing-signatures/a.png",
        signatureSha256: "abc123",
        signatureWidthPx: 80,
        signatureHeightPx: 40,
        signatureByteSize: 1200,
        placements: [
          {
            roleKey: "FA_INVESTOR",
            slotIndex: 2,
            keyword: "CASHSOUK_FA_INVESTOR_2",
            status: "PENDING",
          },
          {
            roleKey: "FA_AGENT",
            slotIndex: 2,
            keyword: "CASHSOUK_FA_AGENT_2",
            status: "SIGNED",
          },
        ],
      })?.signerIndex
    ).toBe(2);
  });
});
