/**
 * Plan-time injection of CashSouk automatic roles.
 */
jest.mock("../../lib/legal-images", () => ({
  readS3ObjectBytes: jest.fn(async () => Buffer.from("png-bytes")),
  confirmLegalImageBytes: jest.fn(() => ({
    sha256: "aa".repeat(32),
    byteSize: 9,
    widthPx: 80,
    heightPx: 40,
    contentType: "image/png",
    transparencyMode: "OPAQUE",
  })),
}));

import { buildEnvelopePlanFromTemplate, type EnvelopePlan } from "@cashsouk/types";
import { injectAutomaticExecutionRoles, freezeIssuerSealForDocument } from "./automatic-signers";
import type { OperatorExecutionBindingRecord } from "./repository";

const FA_TEMPLATE = {
  enabled: true,
  roles: [
    {
      key: "issuer_director" as const,
      label: "Issuer director",
      routing_order: 0,
      kyc_required: true,
    },
  ],
  documents: [
    {
      key: "facility_agreement",
      name: "Facility Agreement",
      source: "TEMPLATE" as const,
      required: true,
      order: 0,
      signer_role_keys: ["issuer_director"],
    },
  ],
};

const HASH = "aa".repeat(32);

function readyBinding(
  roleKey: OperatorExecutionBindingRecord["roleKey"],
  email: string,
  slotIndex: 1 | 2,
  extras?: Partial<OperatorExecutionBindingRecord>
): OperatorExecutionBindingRecord {
  const witness = roleKey.includes("WITNESS");
  return {
    roleKey,
    slotIndex,
    signingPersonId: extras?.signingPersonId ?? `sp-${roleKey}-${slotIndex}`,
    officerName: extras?.officerName ?? `${roleKey} ${slotIndex}`,
    designation: extras?.designation ?? "Chief Executive Officer",
    identityNumber: extras?.identityNumber ?? "850101015555",
    signingEmail: email,
    active: true,
    roles: witness ? ["WITNESS"] : ["AUTHORISED_SIGNATORY", "WITNESS"],
    signatureS3Key: `operator-profile/signing-signatures/${roleKey}-${slotIndex}.png`,
    signatureSha256: HASH,
    signatureConfirmedAt: new Date("2026-09-11T00:00:00.000Z"),
    signatureWidthPx: 80,
    signatureHeightPx: 40,
    signatureByteSize: 9,
    ...extras,
  };
}

function faBindings(options?: { sharedFaPair?: boolean }): OperatorExecutionBindingRecord[] {
  const investor1 = readyBinding("FA_INVESTOR", "aisha@cashsouk.com", 1, {
    signingPersonId: "sp-aisha",
    officerName: "Aisha Rahman",
  });
  const investor2 = readyBinding("FA_INVESTOR", "ben@cashsouk.com", 2, {
    signingPersonId: "sp-ben",
    officerName: "Ben Tan",
  });
  const agentPair = options?.sharedFaPair
    ? [
        readyBinding("FA_AGENT", "aisha@cashsouk.com", 1, {
          signingPersonId: "sp-aisha",
          officerName: "Aisha Rahman",
        }),
        readyBinding("FA_AGENT", "ben@cashsouk.com", 2, {
          signingPersonId: "sp-ben",
          officerName: "Ben Tan",
        }),
      ]
    : [
        readyBinding("FA_AGENT", "chloe@cashsouk.com", 1, {
          signingPersonId: "sp-chloe",
          officerName: "Chloe Lim",
        }),
        readyBinding("FA_AGENT", "dan@cashsouk.com", 2, {
          signingPersonId: "sp-dan",
          officerName: "Dan Wong",
        }),
      ];
  return [
    investor1,
    investor2,
    ...agentPair,
    readyBinding("FA_ISSUER_WITNESS", "witness@cashsouk.com", 1, {
      signingPersonId: "sp-witness",
      officerName: "Farah Noor",
    }),
  ];
}

function manualPlan(): EnvelopePlan {
  return buildEnvelopePlanFromTemplate(FA_TEMPLATE, [
    {
      role_key: "issuer_director",
      name: "Ali Bin Abu",
      email: "ali@issuer.my",
      ic_number: "820508105871",
    },
  ]);
}

describe("injectAutomaticExecutionRoles", () => {
  it("aggregates independent FA Investor and Agent pairs into one recipient per person", async () => {
    const plan = await injectAutomaticExecutionRoles(manualPlan(), faBindings());
    const autos = plan.recipients.filter((recipient) => recipient.execution_mode === "AUTOMATIC");
    expect(autos.map((recipient) => recipient.ref).sort()).toEqual([
      "auto:FA:sp-aisha",
      "auto:FA:sp-ben",
      "auto:FA:sp-chloe",
      "auto:FA:sp-dan",
      "auto:FA:sp-witness",
    ]);
    expect(autos.every((recipient) => recipient.delivery_mode === "INTERNAL")).toBe(true);
    const aisha = plan.assignments.find((assignment) => assignment.recipient_ref === "auto:FA:sp-aisha");
    expect(
      (aisha?.frozen_asset_snapshot as { placements: Array<{ keyword: string }>; signKeyword?: string }).placements.map(
        (placement) => placement.keyword
      )
    ).toEqual(["CASHSOUK_FA_SPAISHA_SIGN"]);
    expect((aisha?.frozen_asset_snapshot as { signKeyword?: string }).signKeyword).toBe(
      "CASHSOUK_FA_SPAISHA_SIGN"
    );
    expect((aisha?.frozen_asset_snapshot as { identityNumber?: string }).identityNumber).toBe(
      "850101015555"
    );
  });

  it("reuses one recipient when the same pair signs Investor and Agent", async () => {
    const plan = await injectAutomaticExecutionRoles(manualPlan(), faBindings({ sharedFaPair: true }));
    const autos = plan.recipients.filter((recipient) => recipient.execution_mode === "AUTOMATIC");
    expect(autos.map((recipient) => recipient.ref).sort()).toEqual([
      "auto:FA:sp-aisha",
      "auto:FA:sp-ben",
      "auto:FA:sp-witness",
    ]);
    const aisha = plan.assignments.find((assignment) => assignment.recipient_ref === "auto:FA:sp-aisha");
    expect(
      (aisha?.frozen_asset_snapshot as { placements: Array<{ keyword: string }>; signKeyword?: string; dateKeyword?: string }).placements.map(
        (placement) => placement.keyword
      )
    ).toEqual(["CASHSOUK_FA_SPAISHA_SIGN", "CASHSOUK_FA_SPAISHA_SIGN"]);
    expect((aisha?.frozen_asset_snapshot as { signKeyword?: string }).signKeyword).toBe(
      "CASHSOUK_FA_SPAISHA_SIGN"
    );
    expect((aisha?.frozen_asset_snapshot as { dateKeyword?: string }).dateKeyword).toBe(
      "CASHSOUK_FA_SPAISHA_DATE"
    );
  });

  it("fails closed when a required representative is missing", async () => {
    await expect(
      injectAutomaticExecutionRoles(manualPlan(), [readyBinding("FA_INVESTOR", "aisha@cashsouk.com", 1)])
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "SIGNING_AUTOMATIC_ROLE_UNBOUND",
    });
  });

  it("fails closed when both Investor representatives share an email", async () => {
    await expect(
      injectAutomaticExecutionRoles(manualPlan(), [
        ...faBindings().filter((row) => row.roleKey !== "FA_INVESTOR"),
        readyBinding("FA_INVESTOR", "same@cashsouk.com", 1, { signingPersonId: "sp-a" }),
        readyBinding("FA_INVESTOR", "same@cashsouk.com", 2, { signingPersonId: "sp-b" }),
      ])
    ).rejects.toMatchObject({
      code: "DOCUMENT_EXECUTION_EMAIL_COLLISION",
    });
  });
});

describe("freezeIssuerSealForDocument", () => {
  const prev = process.env.SC_ENABLE_SEAL_FIELD;

  afterEach(() => {
    if (prev === undefined) delete process.env.SC_ENABLE_SEAL_FIELD;
    else process.env.SC_ENABLE_SEAL_FIELD = prev;
  });

  it("skips seal lookup when SC_ENABLE_SEAL_FIELD=false", async () => {
    process.env.SC_ENABLE_SEAL_FIELD = "false";
    const findActiveIssuerCompanySeal = jest.fn();
    const setAssignmentFrozenCompanySeal = jest.fn();
    await freezeIssuerSealForDocument({
      document: { template_ref: "facility_agreement" } as never,
      assignments: [],
      authorizedParties: null,
      issuerOrganizationId: "org-1",
      repo: { findActiveIssuerCompanySeal, setAssignmentFrozenCompanySeal },
    });
    expect(findActiveIssuerCompanySeal).not.toHaveBeenCalled();
    expect(setAssignmentFrozenCompanySeal).not.toHaveBeenCalled();
  });

  it("freezes issuer company seal using the active seal record (same seal id)", async () => {
    const findActiveIssuerCompanySeal = jest.fn().mockResolvedValue({
      id: "seal_1",
      s3_key: "issuer-organizations/org-1/company-seals/a.png",
      sha256: HASH,
    });
    const setAssignmentFrozenCompanySeal = jest.fn().mockResolvedValue(undefined);

    await freezeIssuerSealForDocument({
      document: { template_ref: "facility_agreement" } as never,
      assignments: [
        {
          assignment: { id: "assign_1" } as never,
          recipient: { execution_mode: "MANUAL", email: "ali@co.my" } as never,
        },
      ],
      authorizedParties: {
        submitted_by_user_id: "user_1",
        submitted_at: "2026-09-01T00:00:00.000Z",
        parties: [
          {
            key: "issuer",
            entity_kind: "ISSUER",
            representatives: [
              {
                name: "Ali Bin Abu",
                email: "ali@co.my",
                ic_number: "820508105871",
                capacity: "director",
                applies_company_seal: true,
              },
            ],
          },
        ],
      } as never,
      issuerOrganizationId: "org-1",
      repo: { findActiveIssuerCompanySeal, setAssignmentFrozenCompanySeal },
    });

    expect(findActiveIssuerCompanySeal).toHaveBeenCalledWith("org-1");
    expect(setAssignmentFrozenCompanySeal).toHaveBeenCalledWith("assign_1", "seal_1");
  });
});
