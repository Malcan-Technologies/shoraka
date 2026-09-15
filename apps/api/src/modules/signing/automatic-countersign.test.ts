import {
  normalizeAutoSignErrorMessage,
  shouldSkipAutomaticCountersign,
  runAutomaticCountersign,
  AUTO_SIGN_MAX_ATTEMPTS,
} from "./automatic-countersign";
import type { SigningEnvelopeWithGraph } from "./mapper";

jest.mock("./automatic-signers", () => ({
  readFrozenSignatureImage: jest.fn(async () => ({
    bytes: Buffer.from("png"),
    sha256: "aa".repeat(32),
    widthPx: 80,
    heightPx: 40,
    byteSize: 3,
    contentType: "image/png",
  })),
}));

describe("automatic countersign helpers", () => {
  it("redacts long hex from provider errors", () => {
    expect(normalizeAutoSignErrorMessage("failed ab".concat("cd".repeat(40)))).toContain("[redacted]");
    expect(normalizeAutoSignErrorMessage("failed ab".concat("cd".repeat(40)))).not.toMatch(/[0-9a-f]{32}/i);
  });

  it("skips when attempts exceed the cap or the last try is too recent", () => {
    const now = new Date("2026-09-11T00:05:00.000Z");
    expect(
      shouldSkipAutomaticCountersign({
        lastAutoSignAt: new Date("2026-09-11T00:04:00.000Z"),
        attemptCount: 1,
        now,
        ignoreBackoff: false,
      })
    ).toBe(true);
    expect(
      shouldSkipAutomaticCountersign({
        lastAutoSignAt: new Date("2026-09-11T00:00:00.000Z"),
        attemptCount: AUTO_SIGN_MAX_ATTEMPTS + 1,
        now,
        ignoreBackoff: false,
      })
    ).toBe(true);
    expect(
      shouldSkipAutomaticCountersign({
        lastAutoSignAt: new Date("2026-09-11T00:04:00.000Z"),
        attemptCount: AUTO_SIGN_MAX_ATTEMPTS + 1,
        now,
        ignoreBackoff: true,
      })
    ).toBe(false);
  });
});

const HASH = "aa".repeat(32);

function faSignerSnapshot(email: string, signerIndex: 1 | 2) {
  const signKeyword = `CASHSOUK_FA_SPFA${signerIndex}_SIGN`;
  return {
    documentKind: "FA",
    signerIndex,
    legalEntityLabel: "CashSouk Sdn Bhd",
    signingPersonId: `sp-FA-${signerIndex}`,
    officerName: signerIndex === 1 ? "Aisha Rahman" : "Cara Lim",
    designation: "CHIEF_EXECUTIVE_OFFICER",
    identityNumber: null,
    signingEmail: email,
    signatureS3Key: `operator-profile/signing-signatures/FA-${signerIndex}.png`,
    signatureSha256: HASH,
    signatureWidthPx: 80,
    signatureHeightPx: 40,
    signatureByteSize: 9,
    signKeyword,
    dateKeyword: `CASHSOUK_FA_SPFA${signerIndex}_DATE`,
    placements: [
      {
        roleKey: "FA_INVESTOR",
        slotIndex: signerIndex,
        keyword: signKeyword,
        status: "PENDING",
      },
      {
        roleKey: "FA_AGENT",
        slotIndex: signerIndex,
        keyword: signKeyword,
        status: "PENDING",
      },
    ],
  };
}

function sharedPairEnvelope(manualStatus: "SIGNED" | "PENDING" = "SIGNED"): SigningEnvelopeWithGraph {
  return {
    id: "env-1",
    documents: [
      {
        id: "d1",
        provider_contract_ref: "sc-1",
        status: "PARTIALLY_SIGNED",
        template_ref: "facility_agreement",
      },
    ],
    recipients: [
      {
        id: "r-manual",
        execution_mode: "MANUAL",
        email: "signer@example.com",
        routing_order: 0,
      },
      {
        id: "r-fa-1",
        execution_mode: "AUTOMATIC",
        delivery_mode: "INTERNAL",
        email: "aisha@cashsouk.com",
        role_key: "FA",
        role_label: "Facility Agreement — signer 1 of 2",
        routing_order: 1001,
      },
    ],
    assignments: [
      {
        id: "a-manual",
        document_id: "d1",
        recipient_id: "r-manual",
        action: "SIGN",
        required: true,
        status: manualStatus,
        auto_sign_attempt_count: 0,
        last_auto_sign_at: null,
      },
      {
        id: "a-fa-1",
        document_id: "d1",
        recipient_id: "r-fa-1",
        action: "SIGN",
        required: true,
        status: "PENDING",
        auto_sign_attempt_count: 0,
        last_auto_sign_at: null,
        frozen_asset_snapshot: faSignerSnapshot("aisha@cashsouk.com", 1),
      },
    ],
  } as unknown as SigningEnvelopeWithGraph;
}

describe("runAutomaticCountersign shared Investor/Agent placements", () => {
  it("waits until every required manual assignment is signed", async () => {
    const autoSign = jest.fn().mockResolvedValue({ alreadySigned: false });
    const result = await runAutomaticCountersign({
      envelope: sharedPairEnvelope("PENDING"),
      provider: {
        name: "test",
        autoSign,
        getContractDetails: jest.fn(),
      } as never,
      repo: {
        markAssignmentSigned: jest.fn(),
        recordAutoSignAttempt: jest.fn(),
        setAssignmentFrozenSnapshot: jest.fn(),
      },
      callbackUrl: null,
      ignoreBackoff: true,
      throwOnFailure: true,
    });
    expect(autoSign).not.toHaveBeenCalled();
    expect(result.attempted).toBe(0);
  });

  it("runs one auto-sign call per signer and signs every owned placement", async () => {
    const envelope = sharedPairEnvelope();
    const autoSign = jest.fn().mockResolvedValue({ alreadySigned: false });
    const setAssignmentFrozenSnapshot = jest.fn().mockImplementation(async (id: string, snapshot: unknown) => {
      const row = envelope.assignments.find((assignment) => assignment.id === id);
      if (row) row.frozen_asset_snapshot = snapshot as never;
    });
    const markAssignmentSigned = jest.fn().mockImplementation(async (id: string) => {
      const row = envelope.assignments.find((assignment) => assignment.id === id);
      if (row) row.status = "SIGNED";
    });
    const result = await runAutomaticCountersign({
      envelope,
      provider: {
        name: "test",
        autoSign,
        getContractDetails: jest.fn().mockResolvedValue({
          documentState: 2,
          signers: [
            { email: "signer@example.com", status: "SIGNED" },
            { email: "aisha@cashsouk.com", status: "SIGNED" },
          ],
        }),
      } as never,
      repo: {
        markAssignmentSigned,
        recordAutoSignAttempt: jest.fn().mockResolvedValue(undefined),
        setAssignmentFrozenSnapshot,
      },
      callbackUrl: null,
      ignoreBackoff: true,
      throwOnFailure: true,
    });
    expect(autoSign).toHaveBeenCalledTimes(1);
    expect(autoSign.mock.calls[0]?.[0]).toMatchObject({
      keyword: "CASHSOUK_FA_SPFA1_SIGN",
      dateKeyword: "CASHSOUK_FA_SPFA1_DATE",
      dateFormat: "dd/MM/yyyy",
    });
    expect(setAssignmentFrozenSnapshot).toHaveBeenCalledTimes(1);
    expect(result.markedSigned).toBe(1);
    expect(markAssignmentSigned).toHaveBeenCalledWith("a-fa-1");
  });

  it("keeps the assignment pending when the grouped auto-sign call fails", async () => {
    const envelope = sharedPairEnvelope();
    const autoSign = jest.fn().mockRejectedValue(new Error("keyword not found"));
    const setAssignmentFrozenSnapshot = jest.fn().mockImplementation(async (id: string, snapshot: unknown) => {
      const row = envelope.assignments.find((assignment) => assignment.id === id);
      if (row) row.frozen_asset_snapshot = snapshot as never;
    });
    const markAssignmentSigned = jest.fn();
    await expect(
      runAutomaticCountersign({
        envelope,
        provider: {
          name: "test",
          autoSign,
          getContractDetails: jest.fn().mockResolvedValue({
            documentState: 2,
            signers: [
              { email: "signer@example.com", status: "SIGNED" },
              { email: "aisha@cashsouk.com", status: "PENDING" },
            ],
          }),
        } as never,
        repo: {
          markAssignmentSigned,
          recordAutoSignAttempt: jest.fn().mockResolvedValue(undefined),
          setAssignmentFrozenSnapshot,
        },
        callbackUrl: null,
        ignoreBackoff: true,
        throwOnFailure: true,
      })
    ).rejects.toMatchObject({
      statusCode: 502,
      code: "SIGNING_AUTOMATIC_SIGN_FAILED",
    });
    expect(autoSign).toHaveBeenCalledTimes(1);
    expect(markAssignmentSigned).not.toHaveBeenCalled();
    const snapshot = envelope.assignments[1]?.frozen_asset_snapshot as {
      placements: Array<{ keyword: string; status: string }>;
    };
    expect(snapshot.placements).toEqual([
      expect.objectContaining({ keyword: "CASHSOUK_FA_SPFA1_SIGN", status: "PENDING" }),
      expect.objectContaining({ keyword: "CASHSOUK_FA_SPFA1_SIGN", status: "PENDING" }),
    ]);
  });

  it("treats alreadySigned as reconciliation for every placement of that signer", async () => {
    const envelope = sharedPairEnvelope();
    const autoSign = jest.fn().mockResolvedValue({ alreadySigned: true });
    const setAssignmentFrozenSnapshot = jest.fn().mockImplementation(async (id: string, snapshot: unknown) => {
      const row = envelope.assignments.find((assignment) => assignment.id === id);
      if (row) row.frozen_asset_snapshot = snapshot as never;
    });
    const markAssignmentSigned = jest.fn().mockImplementation(async (id: string) => {
      const row = envelope.assignments.find((assignment) => assignment.id === id);
      if (row) row.status = "SIGNED";
    });
    const result = await runAutomaticCountersign({
      envelope,
      provider: {
        name: "test",
        autoSign,
        getContractDetails: jest.fn(),
      } as never,
      repo: {
        markAssignmentSigned,
        recordAutoSignAttempt: jest.fn().mockResolvedValue(undefined),
        setAssignmentFrozenSnapshot,
      },
      callbackUrl: null,
      ignoreBackoff: true,
      throwOnFailure: true,
    });
    expect(autoSign).toHaveBeenCalledTimes(1);
    expect(result.markedSigned).toBe(1);
    const snapshot = envelope.assignments[1]?.frozen_asset_snapshot as {
      placements: Array<{ status: string }>;
    };
    expect(snapshot.placements.every((placement) => placement.status === "SIGNED")).toBe(true);
  });
});
