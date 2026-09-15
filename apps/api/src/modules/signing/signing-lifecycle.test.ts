/**
 * Signing send / return / webhook lifecycle after provider-authoritative completion.
 */
jest.mock("../../lib/prisma", () => ({
  prisma: {
    contract: { findUnique: jest.fn(), update: jest.fn() },
    invoice: { findUnique: jest.fn(), update: jest.fn() },
    signingDocument: { findFirst: jest.fn() },
    signingRecipient: { update: jest.fn() },
    issuerOrganizationCompanySeal: { findFirst: jest.fn() },
  },
}));

jest.mock("../applications/logs/service", () => ({
  logApplicationActivity: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../applications/service", () => ({
  applicationService: {
    finalizeOfferAfterEnvelopeCompletion: jest.fn().mockResolvedValue({ skipped: false }),
  },
}));

jest.mock("../ekyc/service", () => ({
  resolveSigningKycStatus: jest.fn().mockResolvedValue("VERIFIED"),
  resolveSigningKycStatusMap: jest.fn().mockResolvedValue(new Map()),
  ekycService: {},
  assertProvidedIcCompatibleWithEmailEkyc: jest.fn(),
}));

jest.mock("../legal-documents/external-acceptance-service", () => ({
  legalExternalAcceptanceService: {
    getWarningForSigningRecipient: jest.fn().mockResolvedValue(null),
    acceptedAtBySigningRecipientIds: jest.fn().mockResolvedValue(new Map()),
    assertSigningRecipientAccepted: jest.fn().mockResolvedValue(undefined),
    recordOpenedForSigningRecipient: jest.fn(),
    recordAcceptedForSigningRecipient: jest.fn(),
  },
}));

jest.mock("../../lib/email/ses-client", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../lib/s3/client", () => ({
  getS3ObjectBuffer: jest.fn(),
  putS3ObjectBuffer: jest.fn(),
}));

jest.mock("../../lib/legal-images", () => ({
  readS3ObjectBytes: jest.fn(),
  confirmLegalImageBytes: jest.fn(),
  confirmSigningCloudLegalImageBytes: jest.fn(),
  confirmSigningCloudLegalImageFromS3: jest.fn(),
}));

jest.mock("../../lib/jobs/with-advisory-lock", () => ({
  JOB_LOCK_KEYS: { SIGNING_ENVELOPE_SEND: 9_001_010 },
  advisoryLockKeyFromId: jest.fn(() => 1),
  withAdvisoryLockPair: jest.fn(async (_key1: number, _key2: number, fn: () => Promise<unknown>) => fn()),
}));

jest.mock("../generated-documents/service", () => ({
  generatedDocumentsService: {
    generateDocument: jest.fn(),
  },
}));

jest.mock("./automatic-signing-keywords", () => {
  const actual = jest.requireActual("./automatic-signing-keywords") as Record<string, unknown>;
  return {
    ...actual,
    ensureAutomaticSigningKeywords: jest.fn(async (buf: Buffer) => buf),
    buildAutomaticSigningCloudSignsetsFromPdf: jest.fn(async () =>
      new Map([
        ["FA_INVESTOR:1", [{ fieldtype: "sign", top: 140, left: 94, width: 120, height: 36, pageindex: 8 }]],
        ["FA_INVESTOR:2", [{ fieldtype: "sign", top: 140, left: 94, width: 120, height: 36, pageindex: 8 }]],
        ["FA_AGENT:1", [{ fieldtype: "sign", top: 140, left: 94, width: 120, height: 36, pageindex: 8 }]],
        ["FA_AGENT:2", [{ fieldtype: "sign", top: 140, left: 94, width: 120, height: 36, pageindex: 8 }]],
        ["FA_ISSUER_WITNESS:1", [{ fieldtype: "sign", top: 140, left: 94, width: 120, height: 36, pageindex: 8 }]],
        ["JSG_OPERATOR:1", [{ fieldtype: "sign", top: 140, left: 94, width: 120, height: 36, pageindex: 8 }]],
        ["JSG_OPERATOR:2", [{ fieldtype: "sign", top: 140, left: 94, width: 120, height: 36, pageindex: 8 }]],
        ["DOA_SSP:1", [{ fieldtype: "sign", top: 140, left: 94, width: 120, height: 36, pageindex: 8 }]],
        ["DOA_SSP:2", [{ fieldtype: "sign", top: 140, left: 94, width: 120, height: 36, pageindex: 8 }]],
      ])
    ),
  };
});

import { prisma } from "../../lib/prisma";
import { getS3ObjectBuffer, putS3ObjectBuffer } from "../../lib/s3/client";
import { readS3ObjectBytes, confirmLegalImageBytes } from "../../lib/legal-images";
import { sendEmail } from "../../lib/email/ses-client";
import { generatedDocumentsService } from "../generated-documents/service";
import { applicationService } from "../applications/service";
import { ApplicationLogEventType, ActivityPortal } from "../applications/logs/types";
import { logApplicationActivity } from "../applications/logs/service";
import { webhookAuditContext } from "../../lib/audit";
import { SigningService } from "./service";
import type { SigningProvider } from "./provider/adapter";
import type { SigningRepository } from "./repository";
import type { SigningEnvelopeWithGraph } from "./mapper";

const logActivity = logApplicationActivity as jest.MockedFunction<typeof logApplicationActivity>;
const finalizeOffer = applicationService.finalizeOfferAfterEnvelopeCompletion as jest.Mock;
const getS3 = getS3ObjectBuffer as jest.Mock;
const generateDocument = generatedDocumentsService.generateDocument as jest.Mock;
const readLegalImage = readS3ObjectBytes as jest.Mock;
const confirmLegalImage = confirmLegalImageBytes as jest.Mock;

const AUTO_SIGN_HASH = "aa".repeat(32);
const AUTO_SIGN_FIELD = {
  fieldtype: "sign" as const,
  top: 140,
  left: 94,
  width: 120,
  height: 36,
  pageindex: 8,
};

function frozenFaSignerSnapshot(email: string, signerIndex: 1 | 2 = 1) {
  const signKeyword = `CASHSOUK_FA_SPFA${signerIndex}_SIGN`;
  return {
    documentKind: "FA" as const,
    signerIndex,
    legalEntityLabel: "CashSouk Sdn Bhd",
    signingPersonId: `sp-FA-${signerIndex}`,
    officerName: signerIndex === 1 ? "Aisha Rahman" : "Cara Lim",
    designation: "Chief Executive Officer",
    identityNumber: "850101015555",
    signingEmail: email,
    signatureS3Key: `operator-profile/signing-signatures/FA-${signerIndex}.png`,
    signatureSha256: AUTO_SIGN_HASH,
    signatureWidthPx: 80,
    signatureHeightPx: 40,
    signatureByteSize: 9,
    signKeyword,
    dateKeyword: `CASHSOUK_FA_SPFA${signerIndex}_DATE`,
    placements: [
      {
        roleKey: "FA_INVESTOR" as const,
        slotIndex: signerIndex,
        keyword: signKeyword,
        status: "PENDING" as const,
      },
      {
        roleKey: "FA_AGENT" as const,
        slotIndex: signerIndex,
        keyword: signKeyword,
        status: "PENDING" as const,
      },
    ],
  };
}

function approvedIssuerOfferDetails() {
  return {
    offer_acceptance: {
      status: "APPROVED_FOR_SIGNING",
      authorized_parties: {
        submitted_by_user_id: "user-1",
        submitted_at: "2026-09-11T00:00:00.000Z",
        parties: [
          {
            key: "issuer",
            entity_kind: "ISSUER",
            representatives: [
              {
                name: "Ali Bin Abu",
                email: "signer@example.com",
                ic_number: "820508105871",
                capacity: "director",
                applies_company_seal: true,
              },
            ],
          },
        ],
      },
    },
  };
}

function faAutomaticRecipients() {
  return {
    signer1: recipientRow({
      id: "r-fa-1",
      role_key: "FA",
      role_label: "Facility Agreement — signer 1 of 2",
      name: "Aisha Rahman",
      email: "aisha@cashsouk.com",
      execution_mode: "AUTOMATIC",
      delivery_mode: "INTERNAL",
      kyc_required: false,
      routing_order: 1001,
    }),
    signer2: recipientRow({
      id: "r-fa-2",
      role_key: "FA",
      role_label: "Facility Agreement — signer 2 of 2",
      name: "Cara Lim",
      email: "ben@cashsouk.com",
      execution_mode: "AUTOMATIC",
      delivery_mode: "INTERNAL",
      kyc_required: false,
      routing_order: 1002,
    }),
    witness: recipientRow({
      id: "r-fa-w",
      role_key: "FA",
      role_label: "CashSouk signatory",
      name: "Farah Noor",
      email: "witness@cashsouk.com",
      execution_mode: "AUTOMATIC",
      delivery_mode: "INTERNAL",
      kyc_required: false,
      routing_order: 1003,
    }),
  };
}

function faAutomaticAssignments() {
  return [
    assignmentRow({
      id: "a-fa-1",
      recipient_id: "r-fa-1",
      frozen_asset_snapshot: frozenFaSignerSnapshot("aisha@cashsouk.com", 1),
    }),
    assignmentRow({
      id: "a-fa-2",
      recipient_id: "r-fa-2",
      frozen_asset_snapshot: frozenFaSignerSnapshot("ben@cashsouk.com", 2),
    }),
    assignmentRow({
      id: "a-fa-w",
      recipient_id: "r-fa-w",
      frozen_asset_snapshot: {
        documentKind: "FA" as const,
        legalEntityLabel: "CashSouk Sdn Bhd",
        signingPersonId: "sp-witness",
        officerName: "Farah Noor",
        designation: null,
        identityNumber: "900101015555",
        signingEmail: "witness@cashsouk.com",
        signatureS3Key: "operator-profile/signing-signatures/sp-witness.png",
        signatureSha256: AUTO_SIGN_HASH,
        signatureWidthPx: 80,
        signatureHeightPx: 40,
        signatureByteSize: 9,
        placements: [
          {
            roleKey: "FA_ISSUER_WITNESS" as const,
            slotIndex: 1,
            keyword: "CASHSOUK_FA_SPWITNESS_SIGN",
            status: "PENDING" as const,
          },
        ],
        signKeyword: "CASHSOUK_FA_SPWITNESS_SIGN",
        dateKeyword: "CASHSOUK_FA_SPWITNESS_DATE",
      },
    }),
  ];
}

function readyExecutionBinding(
  roleKey:
    | "FA_INVESTOR"
    | "FA_AGENT"
    | "JSG_OPERATOR"
    | "DOA_SSP"
    | "FA_ISSUER_WITNESS"
    | "JSG_GUARANTOR_WITNESS"
    | "JSG_OPERATOR_WITNESS"
    | "DOA_ASSIGNOR_WITNESS",
  email: string,
  slotIndex: 1 | 2,
  signingPersonId: string
) {
  const witness = roleKey.includes("WITNESS");
  return {
    roleKey,
    slotIndex,
    signingPersonId,
    officerName: signingPersonId,
    designation: "Chief Executive Officer",
    identityNumber: "850101015555",
    signingEmail: email,
    active: true,
    roles: witness ? (["WITNESS"] as const) : (["AUTHORISED_SIGNATORY", "WITNESS"] as const),
    signatureS3Key: `operator-profile/signing-signatures/${signingPersonId}.png`,
    signatureSha256: AUTO_SIGN_HASH,
    signatureConfirmedAt: new Date("2026-09-11T00:00:00.000Z"),
    signatureWidthPx: 80,
    signatureHeightPx: 40,
    signatureByteSize: 9,
  };
}

function readyFaExecutionBindings() {
  return [
    readyExecutionBinding("FA_INVESTOR", "aisha@cashsouk.com", 1, "sp-aisha"),
    readyExecutionBinding("FA_INVESTOR", "ben@cashsouk.com", 2, "sp-ben"),
    readyExecutionBinding("FA_AGENT", "aisha@cashsouk.com", 1, "sp-aisha"),
    readyExecutionBinding("FA_AGENT", "ben@cashsouk.com", 2, "sp-ben"),
    readyExecutionBinding("FA_ISSUER_WITNESS", "witness@cashsouk.com", 1, "sp-witness"),
  ];
}

function baseEnvelope(
  overrides: Partial<SigningEnvelopeWithGraph> = {}
): SigningEnvelopeWithGraph {
  return {
    id: "env-1",
    application_id: "app-1",
    contract_id: "contract-1",
    invoice_id: null,
    title: "Facility offer signing package",
    status: "SENT",
    created_by_user_id: "admin-1",
    provider_ref: null,
    expires_at: new Date("2026-01-01T00:00:00.000Z"),
    sent_at: new Date("2026-01-01T00:00:00.000Z"),
    completed_at: null,
    voided_at: null,
    void_reason: null,
    send_phase: "IDLE",
    send_error: null,
    send_started_at: null,
    send_attempt_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
    documents: [],
    recipients: [],
    assignments: [],
    ...overrides,
  } as SigningEnvelopeWithGraph;
}

function documentRow(
  overrides: Partial<SigningEnvelopeWithGraph["documents"][number]> = {}
): SigningEnvelopeWithGraph["documents"][number] {
  return {
    id: "d1",
    envelope_id: "env-1",
    name: "Facility Agreement",
    description: null,
    source: "TEMPLATE",
    order: 0,
    required: true,
    status: "PENDING",
    provider_contract_ref: null,
    unsigned_s3_key: "applications/app-1/signing/env-1/unsigned/d1.pdf",
    signed_s3_key: null,
    signed_file_sha256: null,
    template_ref: "facility_agreement",
    metadata: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as SigningEnvelopeWithGraph["documents"][number];
}

function recipientRow(
  overrides: Partial<SigningEnvelopeWithGraph["recipients"][number]> = {}
): SigningEnvelopeWithGraph["recipients"][number] {
  return {
    id: "r1",
    envelope_id: "env-1",
    role_key: "issuer_director",
    role_label: "Director",
    application_guarantor_id: null,
    name: "Ali Bin Abu",
    email: "signer@example.com",
    ic_number: null,
    routing_order: 0,
    kyc_required: true,
    status: "SENT",
    access_token_hash: "hash",
    access_token_expires_at: new Date(Date.now() + 60_000),
    access_code_verified_at: new Date(),
    sent_at: new Date(),
    viewed_at: null,
    completed_at: null,
    declined_at: null,
    decline_reason: null,
    last_reminder_at: null,
    metadata: null,
    execution_mode: "MANUAL",
    delivery_mode: "EMAIL",
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as SigningEnvelopeWithGraph["recipients"][number];
}

function assignmentRow(
  overrides: Partial<SigningEnvelopeWithGraph["assignments"][number]> = {}
): SigningEnvelopeWithGraph["assignments"][number] {
  return {
    id: "a1",
    envelope_id: "env-1",
    document_id: "d1",
    recipient_id: "r1",
    required: true,
    action: "SIGN",
    status: "PENDING",
    signed_at: null,
    signset: null,
    frozen_asset_snapshot: null,
    frozen_company_seal_id: null,
    auto_sign_attempt_count: 0,
    last_auto_sign_error: null,
    last_auto_sign_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as SigningEnvelopeWithGraph["assignments"][number];
}

function createService(repo: Partial<SigningRepository>, provider?: Partial<SigningProvider>) {
  return new SigningService(
    {
      setEnvelopeSendState: jest.fn().mockResolvedValue(undefined),
      setAssignmentFrozenSnapshot: jest.fn().mockResolvedValue(undefined),
      findActiveIssuerCompanySeal: jest.fn().mockResolvedValue({
        id: "seal_1",
        s3_key: "issuer-organizations/org-1/company-seals/a.png",
        sha256: AUTO_SIGN_HASH,
      }),
      ...repo,
    } as SigningRepository,
    (provider ?? {
      name: "test",
      getContractDetails: jest.fn(),
      fetchSignedDocument: jest.fn(),
      createDocumentContract: jest.fn(),
      startSignerSession: jest.fn(),
    }) as SigningProvider
  );
}

function stubSendPrerequisites(service: SigningService) {
  jest
    .spyOn(service as never, "assertOfferAcceptanceAllowsSigning")
    .mockResolvedValue(undefined as never);
  jest.spyOn(service as never, "getProductWorkflowForApplication").mockResolvedValue([] as never);
  jest.spyOn(service as never, "readSigningTemplateFromWorkflow").mockReturnValue({
    recipients: [],
    documents: [],
  } as never);
  jest
    .spyOn(service as never, "assertBindingsMatchApprovedSnapshot")
    .mockReturnValue(undefined as never);
}

describe("signing lifecycle", () => {
  const previousIssuerUrl = process.env.ISSUER_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ISSUER_URL;
    (prisma.contract.findUnique as jest.Mock).mockResolvedValue({ offer_details: {} });
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.issuerOrganizationCompanySeal.findFirst as jest.Mock).mockResolvedValue({
      id: "seal_1",
    });
    readLegalImage.mockResolvedValue(Buffer.from("png-bytes"));
    confirmLegalImage.mockReturnValue({
      sha256: AUTO_SIGN_HASH,
      byteSize: 9,
      widthPx: 80,
      heightPx: 40,
      contentType: "image/png",
      transparencyMode: "OPAQUE",
    });
  });

  afterEach(() => {
    if (previousIssuerUrl === undefined) delete process.env.ISSUER_URL;
    else process.env.ISSUER_URL = previousIssuerUrl;
  });

  it("rejects start-signing for a draft envelope", async () => {
    const envelope = baseEnvelope({
      status: "DRAFT",
      documents: [documentRow({ status: "DRAFT", provider_contract_ref: null })],
      recipients: [recipientRow()],
      assignments: [assignmentRow()],
    });
    const service = createService({
      findById: jest.fn().mockResolvedValue(envelope),
    });

    await expect(
      service.startRecipientSigning({
        envelopeId: "env-1",
        recipientId: "r1",
        documentId: "d1",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "SIGNING_ENVELOPE_NOT_SENT",
    });
  });

  it("keeps SENT and records failed delivery when invitation email cannot send", async () => {
    const envelope = baseEnvelope({
      status: "DRAFT",
      documents: [documentRow({ provider_contract_ref: "sc-already", template_ref: "offer_letter" })],
      recipients: [recipientRow({ status: "DRAFT" })],
      assignments: [assignmentRow()],
    });
    const markEnvelopeSent = jest.fn().mockResolvedValue(undefined);
    const setRecipientEmailDeliveryStatus = jest.fn().mockResolvedValue(undefined);
    const repo: Partial<SigningRepository> = {
      findById: jest.fn().mockResolvedValue(envelope),
      findApplicationContext: jest.fn().mockResolvedValue({
        id: "app-1",
        status: "CONTRACT_SENT",
        issuer_organization_id: "org-1",
        contract_id: "contract-1",
        product_id: "p1",
        product_version: 1,
        invoices: [],
        issuer_organization: { owner_user_id: "issuer-1" },
        supporting_documents: [],
      }),
      markEnvelopeSent,
      setRecipientAccessToken: jest.fn().mockResolvedValue(undefined),
      setRecipientEmailDeliveryStatus,
    };
    const createDocumentContract = jest.fn();
    const service = createService(repo, {
      name: "test",
      createDocumentContract,
      getContractDetails: jest.fn(),
      fetchSignedDocument: jest.fn(),
      startSignerSession: jest.fn(),
    });
    stubSendPrerequisites(service);

    await expect(
      service.sendEnvelope("env-1", { userId: "admin-1", portal: "ADMIN" as never })
    ).resolves.toBeDefined();

    expect(createDocumentContract).not.toHaveBeenCalled();
    expect(markEnvelopeSent).toHaveBeenCalled();
    expect(setRecipientEmailDeliveryStatus).toHaveBeenCalledWith(
      "r1",
      "failed",
      "Email delivery failed"
    );
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: ApplicationLogEventType.SIGNING_PACKAGE_SENT,
      })
    );
  });

  it("recomputes layout signsets from a cached unsigned PDF and merges duplicate emails", async () => {
    const fieldA = { fieldtype: "sign", top: 100, left: 20, width: 140, height: 36, pageindex: 1 };
    const fieldB = { fieldtype: "sign", top: 180, left: 20, width: 140, height: 36, pageindex: 1 };
    const autos = faAutomaticRecipients();
    const envelope = baseEnvelope({
      status: "DRAFT",
      documents: [documentRow()],
      recipients: [
        recipientRow({ id: "r1", name: "Ali Bin Abu", routing_order: 0 }),
        recipientRow({ id: "r2", name: "Siti Binti Ahmad", routing_order: 1 }),
        autos.signer1,
        autos.signer2,
        autos.witness,
      ],
      assignments: [
        assignmentRow({ id: "a1", recipient_id: "r1" }),
        assignmentRow({ id: "a2", recipient_id: "r2" }),
        ...faAutomaticAssignments(),
      ],
    });
    (prisma.contract.findUnique as jest.Mock).mockResolvedValue({
      offer_details: approvedIssuerOfferDetails(),
    });
    const setAssignmentSignset = jest.fn().mockResolvedValue(undefined);
    const repo: Partial<SigningRepository> = {
      findById: jest.fn().mockResolvedValue(envelope),
      findApplicationContext: jest.fn().mockResolvedValue({
        id: "app-1",
        status: "CONTRACT_SENT",
        issuer_organization_id: "org-1",
        contract_id: "contract-1",
        product_id: "p1",
        product_version: 1,
        invoices: [],
        issuer_organization: { owner_user_id: "issuer-1" },
        supporting_documents: [],
      }),
      markEnvelopeSent: jest.fn().mockResolvedValue(undefined),
      markDocumentSent: jest.fn().mockResolvedValue(undefined),
      setAssignmentSignset,
      setRecipientAccessToken: jest.fn().mockResolvedValue(undefined),
      setRecipientEmailDeliveryStatus: jest.fn().mockResolvedValue(undefined),
      findActiveIssuerCompanySeal: jest.fn().mockResolvedValue({
        id: "seal_1",
        s3_key: "issuer-orgs/org-1/company-seal.png",
        sha256: AUTO_SIGN_HASH,
      }),
      setAssignmentFrozenCompanySeal: jest.fn().mockResolvedValue(undefined),
    };
    const createDocumentContract = jest.fn().mockResolvedValue({ providerRef: "sc-new" });
    const uploadSignerStamp = jest.fn().mockResolvedValue(undefined);
    const service = createService(repo, {
      name: "test",
      createDocumentContract,
      getContractDetails: jest.fn(),
      fetchSignedDocument: jest.fn(),
      startSignerSession: jest.fn(),
      uploadSignerStamp,
    });
    stubSendPrerequisites(service);
    getS3.mockResolvedValue(Buffer.from("%PDF-cached"));
    jest
      .spyOn(service as never, "signsetsForTemplatePdf")
      .mockResolvedValue([[fieldA], [fieldB]] as never);

    await service.sendEnvelope("env-1", { userId: "admin-1", portal: "ADMIN" as never });

    expect(generateDocument).not.toHaveBeenCalled();
    expect(getS3).toHaveBeenCalledWith("applications/app-1/signing/env-1/unsigned/d1.pdf");
    expect(setAssignmentSignset).toHaveBeenCalledWith("a1", [fieldA]);
    expect(setAssignmentSignset).toHaveBeenCalledWith("a2", [fieldB]);
    expect(createDocumentContract).toHaveBeenCalledWith({
      pdfBuffer: Buffer.from("%PDF-cached"),
      contractName: "Facility offer signing package — Facility Agreement",
      signers: [
        { email: "signer@example.com", executionMode: "MANUAL", signset: [fieldA, fieldB] },
        { email: "aisha@cashsouk.com", executionMode: "AUTOMATIC", signset: [AUTO_SIGN_FIELD, AUTO_SIGN_FIELD] },
        { email: "ben@cashsouk.com", executionMode: "AUTOMATIC", signset: [AUTO_SIGN_FIELD, AUTO_SIGN_FIELD] },
        { email: "witness@cashsouk.com", executionMode: "AUTOMATIC", signset: [AUTO_SIGN_FIELD] },
      ],
    });
  });

  it("returns the draft immediately when waitForProvider is false", async () => {
    const autos = faAutomaticRecipients();
    const envelope = baseEnvelope({
      status: "DRAFT",
      metadata: null,
      sent_at: null,
      documents: [documentRow()],
      recipients: [
        recipientRow({ id: "r1", name: "Ali Bin Abu", routing_order: 0 }),
        autos.signer1,
        autos.signer2,
        autos.witness,
      ],
      assignments: [assignmentRow({ id: "a1", recipient_id: "r1" }), ...faAutomaticAssignments()],
    });
    (prisma.contract.findUnique as jest.Mock).mockResolvedValue({
      offer_details: approvedIssuerOfferDetails(),
    });
    const markEnvelopeSent = jest.fn().mockResolvedValue(undefined);
    const setEnvelopeSendState = jest.fn().mockImplementation(async (_id, input) => {
      envelope.send_phase = input.phase;
      envelope.send_error = input.error ?? null;
      envelope.send_started_at = new Date();
    });
    const repo: Partial<SigningRepository> = {
      findById: jest.fn().mockImplementation(async () => envelope),
      findApplicationContext: jest.fn().mockResolvedValue({
        id: "app-1",
        status: "CONTRACT_SENT",
        issuer_organization_id: "org-1",
        contract_id: "contract-1",
        product_id: "p1",
        product_version: 1,
        invoices: [],
        issuer_organization: { owner_user_id: "issuer-1" },
        supporting_documents: [],
      }),
      setEnvelopeSendState,
      markEnvelopeSent,
      markDocumentSent: jest.fn().mockResolvedValue(undefined),
      setAssignmentSignset: jest.fn().mockResolvedValue(undefined),
      setRecipientAccessToken: jest.fn().mockResolvedValue(undefined),
      setRecipientEmailDeliveryStatus: jest.fn().mockResolvedValue(undefined),
      findActiveIssuerCompanySeal: jest.fn().mockResolvedValue({
        id: "seal_1",
        s3_key: "issuer-orgs/org-1/company-seal.png",
        sha256: AUTO_SIGN_HASH,
      }),
      setAssignmentFrozenCompanySeal: jest.fn().mockResolvedValue(undefined),
    };
    const createDocumentContract = jest.fn().mockImplementation(
      () => new Promise<{ providerRef: string }>(() => undefined)
    );
    const service = createService(repo, {
      name: "test",
      createDocumentContract,
      getContractDetails: jest.fn(),
      fetchSignedDocument: jest.fn(),
      startSignerSession: jest.fn(),
      uploadSignerStamp: jest.fn().mockResolvedValue(undefined),
    });
    stubSendPrerequisites(service);
    getS3.mockResolvedValue(Buffer.from("%PDF-cached"));
    jest.spyOn(service as never, "signsetsForTemplatePdf").mockResolvedValue([[{ fieldtype: "sign" }]] as never);

    const result = await service.sendEnvelope("env-1", {
      userId: "admin-1",
      portal: "ADMIN" as never,
      waitForProvider: false,
    });

    expect(result.status).toBe("DRAFT");
    expect(result.send_in_progress).toBe(true);
    expect(markEnvelopeSent).not.toHaveBeenCalled();
    expect(setEnvelopeSendState).toHaveBeenCalledWith("env-1", {
      phase: "PREPARING",
      error: null,
      incrementAttempt: true,
    });
  });

  it("rejects send when a CashSouk automatic email matches a manual signer", async () => {
    const autos = faAutomaticRecipients();
    const envelope = baseEnvelope({
      status: "DRAFT",
      sent_at: null,
      documents: [documentRow()],
      recipients: [
        recipientRow({ id: "r1", name: "Ali Bin Abu", routing_order: 0 }),
        { ...autos.signer1, email: "signer@example.com" },
        autos.signer2,
        autos.witness,
      ],
      assignments: [assignmentRow({ id: "a1", recipient_id: "r1" }), ...faAutomaticAssignments()],
    });
    (prisma.contract.findUnique as jest.Mock).mockResolvedValue({
      offer_details: approvedIssuerOfferDetails(),
    });
    const createDocumentContract = jest.fn();
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(envelope),
        findApplicationContext: jest.fn().mockResolvedValue({
          id: "app-1",
          status: "CONTRACT_SENT",
          issuer_organization_id: "org-1",
          contract_id: "contract-1",
          product_id: "p1",
          product_version: 1,
          invoices: [],
          issuer_organization: { owner_user_id: "issuer-1" },
          supporting_documents: [],
        }),
      },
      {
        name: "test",
        createDocumentContract,
        getContractDetails: jest.fn(),
        fetchSignedDocument: jest.fn(),
        startSignerSession: jest.fn(),
      }
    );
    stubSendPrerequisites(service);

    await expect(
      service.sendEnvelope("env-1", { userId: "admin-1", portal: "ADMIN" as never })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "SIGNING_BINDINGS_INVALID",
    });
    expect(createDocumentContract).not.toHaveBeenCalled();
  });

  it("does not mark an assignment signed when the provider still reports pending", async () => {
    const recipient = recipientRow({
      metadata: {
        last_signing_session: {
          documentId: "d1",
          startedAt: new Date().toISOString(),
          returnSessionId: "rs-1",
        },
      },
    });
    const envelope = baseEnvelope({
      documents: [documentRow({ provider_contract_ref: "sc-1" })],
      recipients: [recipient],
      assignments: [assignmentRow()],
    });
    const markAssignmentSigned = jest.fn();
    const repo: Partial<SigningRepository> = {
      findById: jest.fn().mockResolvedValue(envelope),
      findRecipientByReturnSessionId: jest.fn().mockResolvedValue({
        envelope,
        recipientId: "r1",
      }),
      markAssignmentSigned,
      markRecipientViewedIfUnset: jest.fn(),
    };
    const service = createService(repo, {
      name: "test",
      getContractDetails: jest.fn().mockResolvedValue({
        documentState: 0,
        signers: [{ email: "signer@example.com", status: "PENDING", name: "Ali" }],
      }),
      fetchSignedDocument: jest.fn(),
      createDocumentContract: jest.fn(),
      startSignerSession: jest.fn(),
    });

    const session = await service.confirmRecipientSignedForReturnSession("rs-1");

    expect(markAssignmentSigned).not.toHaveBeenCalled();
    expect(session.envelope.assignments[0]?.status).toBe("PENDING");
  });

  it("stores a missing signed PDF when a completed envelope is reconciled", async () => {
    const envelope = baseEnvelope({
      status: "COMPLETED",
      completed_at: new Date(),
      documents: [
        documentRow({
          status: "COMPLETED",
          provider_contract_ref: "sc-1",
          signed_s3_key: null,
        }),
      ],
      recipients: [recipientRow({ status: "SIGNED" })],
      assignments: [assignmentRow({ status: "SIGNED", signed_at: new Date() })],
    });
    const recordSignedDocument = jest.fn().mockImplementation(async (_id, key, sha256) => {
      envelope.documents[0].signed_s3_key = key;
      envelope.documents[0].signed_file_sha256 = sha256;
    });
    const repo: Partial<SigningRepository> = {
      findById: jest.fn().mockResolvedValue(envelope),
      findByDocumentProviderRef: jest.fn().mockResolvedValue(envelope),
      recordSignedDocument,
      markAssignmentSigned: jest.fn(),
      markRecipientViewedIfUnset: jest.fn(),
    };
    const fetchSignedDocument = jest.fn().mockResolvedValue({
      pdfBuffer: Buffer.from("%PDF-signed"),
      sha256: "abc123",
    });
    const service = createService(repo, {
      name: "test",
      getContractDetails: jest.fn().mockResolvedValue({
        documentState: 4,
        signers: [{ email: "signer@example.com", status: "SIGNED", name: "Ali" }],
      }),
      fetchSignedDocument,
      createDocumentContract: jest.fn(),
      startSignerSession: jest.fn(),
    });

    const result = await service.applyProviderContractSigned("sc-1");

    expect(result).toEqual({ skipped: false });
    expect(fetchSignedDocument).toHaveBeenCalledWith({ providerRef: "sc-1" });
    expect(putS3ObjectBuffer).toHaveBeenCalledWith({
      key: "applications/app-1/signing/env-1/d1.pdf",
      body: Buffer.from("%PDF-signed"),
      contentType: "application/pdf",
    });
    expect(recordSignedDocument).toHaveBeenCalledWith(
      "d1",
      "applications/app-1/signing/env-1/d1.pdf",
      "abc123",
      "COMPLETED"
    );
    expect(finalizeOffer).toHaveBeenCalled();
  });

  it("stores a missing signed PDF when rollup finalization rejects", async () => {
    const envelope = baseEnvelope({
      status: "IN_PROGRESS",
      documents: [
        documentRow({
          id: "offer",
          name: "Offer Letter",
          source: "GENERATED_OFFER_LETTER",
          order: 0,
          status: "PENDING",
          provider_contract_ref: "sc-offer",
          signed_s3_key: "applications/app-1/signing/env-1/offer.pdf",
          signed_file_sha256: "offer-sha",
        }),
        documentRow({
          id: "d2",
          name: "Deed of Assignment",
          template_ref: "deed_of_assignment",
          order: 1,
          status: "PENDING",
          provider_contract_ref: "sc-2",
          signed_s3_key: null,
        }),
      ],
      recipients: [recipientRow()],
      assignments: [
        assignmentRow({
          id: "a-offer",
          document_id: "offer",
          status: "PENDING",
        }),
        assignmentRow({
          id: "a2",
          document_id: "d2",
          status: "PENDING",
        }),
      ],
    });
    const recordSignedDocument = jest.fn().mockImplementation(async (id, key, sha256) => {
      const document = envelope.documents.find((row) => row.id === id);
      if (!document) return;
      document.signed_s3_key = key;
      document.signed_file_sha256 = sha256;
    });
    const repo: Partial<SigningRepository> = {
      findById: jest.fn().mockResolvedValue(envelope),
      recordSignedDocument,
      markAssignmentSigned: jest.fn().mockImplementation(async (id) => {
        const assignment = envelope.assignments.find((row) => row.id === id);
        if (assignment) assignment.status = "SIGNED";
      }),
      markRecipientViewedIfUnset: jest.fn(),
      updateRecipientStatus: jest.fn().mockImplementation(async (_id, status) => {
        envelope.recipients[0].status = status;
      }),
      updateDocumentStatus: jest.fn().mockImplementation(async (id, status) => {
        const document = envelope.documents.find((row) => row.id === id);
        if (document) document.status = status;
      }),
      updateEnvelopeStatusIfCurrent: jest.fn().mockImplementation(async (_id, _from, next) => {
        envelope.status = next;
        return true;
      }),
    };
    const fetchSignedDocument = jest.fn().mockImplementation(async ({ providerRef }: { providerRef: string }) => {
      if (providerRef === "sc-2") {
        return { pdfBuffer: Buffer.from("%PDF-missing"), sha256: "missing-sha" };
      }
      return { pdfBuffer: Buffer.from("%PDF-offer"), sha256: "offer-sha" };
    });
    finalizeOffer.mockRejectedValue(new Error("issuer org membership required"));
    const service = createService(repo, {
      name: "test",
      getContractDetails: jest.fn().mockResolvedValue({
        documentState: 4,
        signers: [{ email: "signer@example.com", status: "SIGNED", name: "Ali" }],
      }),
      fetchSignedDocument,
      createDocumentContract: jest.fn(),
      startSignerSession: jest.fn(),
    });

    await expect(service.syncEnvelopeFromProvider("env-1")).resolves.toBeUndefined();

    expect(envelope.status).toBe("COMPLETED");
    expect(finalizeOffer).toHaveBeenCalled();
    expect(fetchSignedDocument).toHaveBeenCalledWith({ providerRef: "sc-2" });
    expect(putS3ObjectBuffer).toHaveBeenCalledWith({
      key: "applications/app-1/signing/env-1/d2.pdf",
      body: Buffer.from("%PDF-missing"),
      contentType: "application/pdf",
    });
    expect(recordSignedDocument).toHaveBeenCalledWith(
      "d2",
      "applications/app-1/signing/env-1/d2.pdf",
      "missing-sha",
      "COMPLETED"
    );
  });

  it("admin provider sync skips issuer access and closed envelopes", async () => {
    const completed = baseEnvelope({ status: "COMPLETED" });
    const voided = baseEnvelope({ id: "env-void", status: "VOIDED" });
    const findById = jest.fn().mockImplementation(async (id: string) => {
      return id === "env-void" ? voided : completed;
    });
    const service = createService({ findById });
    const sync = jest.spyOn(service, "syncEnvelopeFromProvider").mockResolvedValue(undefined);
    const context = { source: "API", portal: "ADMIN", actorUserId: "admin-1" } as never;

    const dto = await service.syncEnvelopeFromProviderForAdmin("env-1", { context });
    expect(sync).toHaveBeenCalledWith("env-1", { context });
    expect(dto.id).toBe("env-1");

    sync.mockClear();
    await service.syncEnvelopeFromProviderForAdmin("env-void", { context });
    expect(sync).not.toHaveBeenCalled();
  });

  it("ignores webhooks for voided envelopes", async () => {
    const envelope = baseEnvelope({ status: "VOIDED" });
    const getContractDetails = jest.fn();
    const service = createService(
      {
        findByDocumentProviderRef: jest.fn().mockResolvedValue(envelope),
        findById: jest.fn().mockResolvedValue(envelope),
      },
      {
        name: "test",
        getContractDetails,
        fetchSignedDocument: jest.fn(),
        createDocumentContract: jest.fn(),
        startSignerSession: jest.fn(),
      }
    );

    await expect(service.applyProviderContractSigned("sc-1")).resolves.toEqual({ skipped: true });
    expect(getContractDetails).not.toHaveBeenCalled();
  });

  it("reminder for a later document deep-links past the first unsigned assignment", async () => {
    process.env.ISSUER_URL = "https://issuer.example";
    const recipient = recipientRow();
    const envelope = baseEnvelope({
      documents: [
        documentRow({
          id: "doa",
          name: "Deed of Assignment",
          order: 1,
          template_ref: "deed_of_assignment",
          provider_contract_ref: "sc-doa",
        }),
        documentRow({
          id: "fa",
          name: "Facility Agreement",
          order: 2,
          template_ref: "facility_agreement",
          provider_contract_ref: "sc-fa",
        }),
      ],
      recipients: [recipient],
      assignments: [
        assignmentRow({ id: "a-doa", document_id: "doa" }),
        assignmentRow({ id: "a-fa", document_id: "fa" }),
      ],
    });
    const setRecipientAccessToken = jest.fn().mockResolvedValue(undefined);
    const service = createService({
      findById: jest.fn().mockResolvedValue(envelope),
      setRecipientAccessToken,
      setRecipientEmailDeliveryStatus: jest.fn().mockResolvedValue(undefined),
      touchRecipientReminder: jest.fn().mockResolvedValue(undefined),
    });

    await service.remindRecipient("env-1", "r1", "fa");

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "signer@example.com",
        subject: "Reminder: Facility Agreement",
        text: expect.stringContaining(
          "https://issuer.example/signing/external/"
        ),
      })
    );
    const text = (sendEmail as jest.Mock).mock.calls[0][0].text as string;
    expect(text).toContain("Start with Facility Agreement.");
    expect(text).toMatch(/signing\/external\/[^?\s]+\?document=fa/);
  });

  const FA_TEMPLATE = {
    enabled: true,
    roles: [
      {
        key: "issuer_director",
        label: "Issuer director",
        source_hint: "issuer_director",
        routing_order: 0,
        kyc_required: true,
      },
    ],
    documents: [
      {
        key: "facility_agreement",
        name: "Facility Agreement",
        source: "TEMPLATE",
        required: true,
        order: 0,
        signer_role_keys: ["issuer_director"],
      },
    ],
  };

  it("injects Facility Agreement automatic signers on draft create", async () => {
    const createFromPlan = jest.fn().mockResolvedValue(
      baseEnvelope({
        documents: [documentRow()],
        recipients: [recipientRow()],
        assignments: [assignmentRow()],
      })
    );
    const service = createService({
      createFromPlan,
      findOperatorDocumentExecutionBindings: jest.fn().mockResolvedValue(readyFaExecutionBindings()),
      findOperatorCompanyStamp: jest.fn().mockResolvedValue(null),
    });

    await service.createDraftEnvelope({
      applicationId: "app-1",
      title: "Facility offer signing package",
      templateConfig: FA_TEMPLATE,
      bindings: [
        {
          role_key: "issuer_director",
          name: "Ali Bin Abu",
          email: "ali@issuer.my",
          ic_number: "820508105871",
        },
      ],
    });

    const plan = createFromPlan.mock.calls[0][0].plan;
    const autos = plan.recipients.filter(
      (recipient: { execution_mode?: string }) => recipient.execution_mode === "AUTOMATIC"
    );
    expect(autos.map((recipient: { ref: string }) => recipient.ref).sort()).toEqual([
      "auto:FA:sp-aisha",
      "auto:FA:sp-ben",
      "auto:FA:sp-witness",
    ]);
    expect(autos.every((recipient: { delivery_mode?: string }) => recipient.delivery_mode === "INTERNAL")).toBe(
      true
    );
  });

  it("fails send when a required CashSouk binding is missing", async () => {
    const envelope = baseEnvelope({
      status: "DRAFT",
      documents: [documentRow({ template_ref: "facility_agreement" })],
      recipients: [recipientRow({ status: "PENDING" })],
      assignments: [assignmentRow()],
    });
    const service = createService({
      findById: jest.fn().mockResolvedValue(envelope),
      findApplicationContext: jest.fn().mockResolvedValue({
        id: "app-1",
        status: "CONTRACT_SENT",
        issuer_organization_id: "org-1",
        contract_id: "contract-1",
        product_id: "p1",
        product_version: 1,
        invoices: [],
        issuer_organization: { owner_user_id: "issuer-1" },
        supporting_documents: [],
      }),
    });
    stubSendPrerequisites(service);

    await expect(
      service.sendEnvelope("env-1", { userId: "admin-1", portal: "ADMIN" as never })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "SIGNING_AUTOMATIC_ROLE_UNBOUND",
    });
  });

  it("fails send when only Facility Agreement signer 1 is frozen", async () => {
    const autos = faAutomaticRecipients();
    const envelope = baseEnvelope({
      status: "DRAFT",
      documents: [documentRow({ template_ref: "facility_agreement" })],
      recipients: [recipientRow({ status: "PENDING" }), autos.signer1],
      assignments: [
        assignmentRow(),
        assignmentRow({
          id: "a-fa-1",
          recipient_id: "r-fa-1",
          frozen_asset_snapshot: frozenFaSignerSnapshot("aisha@cashsouk.com", 1),
        }),
      ],
    });
    const service = createService({
      findById: jest.fn().mockResolvedValue(envelope),
      findApplicationContext: jest.fn().mockResolvedValue({
        id: "app-1",
        status: "CONTRACT_SENT",
        issuer_organization_id: "org-1",
        contract_id: "contract-1",
        product_id: "p1",
        product_version: 1,
        invoices: [],
        issuer_organization: { owner_user_id: "issuer-1" },
        supporting_documents: [],
      }),
    });
    stubSendPrerequisites(service);

    await expect(
      service.sendEnvelope("env-1", { userId: "admin-1", portal: "ADMIN" as never })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "SIGNING_AUTOMATIC_ROLE_UNBOUND",
    });
  });

  it("does not email automatic CashSouk recipients", async () => {
    process.env.ISSUER_URL = "https://issuer.example";
    (prisma.contract.findUnique as jest.Mock).mockResolvedValue({
      offer_details: approvedIssuerOfferDetails(),
    });
    const autos = faAutomaticRecipients();
    const envelope = baseEnvelope({
      status: "DRAFT",
      documents: [documentRow({ provider_contract_ref: "sc-already" })],
      recipients: [recipientRow({ status: "PENDING" }), ...Object.values(autos)],
      assignments: [assignmentRow({ id: "a1", recipient_id: "r1" }), ...faAutomaticAssignments()],
    });
    const setRecipientEmailDeliveryStatus = jest.fn().mockResolvedValue(undefined);
    const service = createService({
      findById: jest.fn().mockResolvedValue(envelope),
      findApplicationContext: jest.fn().mockResolvedValue({
        id: "app-1",
        status: "CONTRACT_SENT",
        issuer_organization_id: "org-1",
        contract_id: "contract-1",
        product_id: "p1",
        product_version: 1,
        invoices: [],
        issuer_organization: { owner_user_id: "issuer-1" },
        supporting_documents: [],
      }),
      markEnvelopeSent: jest.fn().mockResolvedValue(undefined),
      setRecipientAccessToken: jest.fn().mockResolvedValue(undefined),
      setRecipientEmailDeliveryStatus,
    });
    stubSendPrerequisites(service);

    await service.sendEnvelope("env-1", { userId: "admin-1", portal: "ADMIN" as never });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect((sendEmail as jest.Mock).mock.calls[0][0].to).toBe("signer@example.com");
    expect(setRecipientEmailDeliveryStatus).toHaveBeenCalledTimes(1);
    expect(setRecipientEmailDeliveryStatus).toHaveBeenCalledWith("r1", "sent", null);
  });

  it("auto-signs after every manual assignment is signed", async () => {
    const automatic = recipientRow({
      id: "r-fa-1",
      role_key: "FA",
      role_label: "Facility Agreement — signer 1 of 2",
      name: "Aisha Rahman",
      email: "aisha@cashsouk.com",
      execution_mode: "AUTOMATIC",
      delivery_mode: "INTERNAL",
      kyc_required: false,
      routing_order: 1001,
      status: "SENT",
    });
    const envelope = baseEnvelope({
      documents: [documentRow({ provider_contract_ref: "sc-1", status: "PARTIALLY_SIGNED" })],
      recipients: [recipientRow({ status: "SIGNED" }), automatic],
      assignments: [
        assignmentRow({ id: "a1", recipient_id: "r1", status: "SIGNED", signed_at: new Date() }),
        assignmentRow({
          id: "a-fa-1",
          recipient_id: "r-fa-1",
          status: "SENT",
          frozen_asset_snapshot: frozenFaSignerSnapshot("aisha@cashsouk.com", 1),
        }),
      ],
    });
    const markAssignmentSigned = jest.fn().mockImplementation(async (id: string) => {
      const row = envelope.assignments.find((assignment) => assignment.id === id);
      if (row) row.status = "SIGNED";
    });
    const recordAutoSignAttempt = jest.fn().mockResolvedValue(undefined);
    const recordSignedDocument = jest.fn().mockImplementation(async (_id, key, sha256) => {
      envelope.documents[0].signed_s3_key = key;
      envelope.documents[0].signed_file_sha256 = sha256;
      envelope.documents[0].status = "COMPLETED";
    });
    const repo: Partial<SigningRepository> = {
      findById: jest.fn().mockResolvedValue(envelope),
      markAssignmentSigned,
      markRecipientViewedIfUnset: jest.fn(),
      recordAutoSignAttempt,
      recordSignedDocument,
      updateRecipientStatus: jest.fn().mockImplementation(async (id, status) => {
        const row = envelope.recipients.find((recipient) => recipient.id === id);
        if (row) row.status = status;
      }),
      updateDocumentStatus: jest.fn().mockImplementation(async (_id, status) => {
        envelope.documents[0].status = status;
      }),
      updateEnvelopeStatusIfCurrent: jest.fn().mockImplementation(async (_id, _from, next) => {
        envelope.status = next;
        return true;
      }),
    };
    const autoSign = jest.fn().mockResolvedValue({ alreadySigned: false });
    const getContractDetails = jest.fn().mockResolvedValue({
      documentState: 2,
      signers: [
        { email: "signer@example.com", status: "SIGNED", name: "Ali" },
        { email: "aisha@cashsouk.com", status: "PENDING", name: "Aisha" },
      ],
    });
    const fetchSignedDocument = jest.fn().mockResolvedValue({
      pdfBuffer: Buffer.from("%PDF-signed"),
      sha256: "abc123",
    });
    const service = createService(repo, {
      name: "test",
      getContractDetails,
      fetchSignedDocument,
      createDocumentContract: jest.fn(),
      startSignerSession: jest.fn(),
      autoSign,
    });

    await service.syncEnvelopeFromProvider("env-1");

    expect(autoSign).toHaveBeenCalledTimes(1);
    expect(autoSign.mock.calls.map((call) => call[0].keyword)).toEqual(["CASHSOUK_FA_SPFA1_SIGN"]);
    expect(markAssignmentSigned).toHaveBeenCalledWith("a-fa-1");
    expect(fetchSignedDocument).toHaveBeenCalledWith({ providerRef: "sc-1" });
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        portal: null,
        eventType: ApplicationLogEventType.SIGNING_DOCUMENT_SIGNED,
        metadata: expect.objectContaining({
          assignment_id: "a-fa-1",
          execution_mode: "AUTOMATIC",
          signer_name: "Aisha Rahman",
        }),
      })
    );
    expect(JSON.stringify(logActivity.mock.calls)).not.toMatch(/aisha@cashsouk\.com|850101015555/i);
  });

  it("does not treat provider email SIGNED as completing automatic placements", async () => {
    const automatic = recipientRow({
      id: "r-fa-1",
      role_key: "FA",
      role_label: "Facility Agreement — signer 1 of 2",
      name: "Aisha Rahman",
      email: "aisha@cashsouk.com",
      execution_mode: "AUTOMATIC",
      delivery_mode: "INTERNAL",
      kyc_required: false,
      routing_order: 1001,
      status: "SENT",
    });
    const envelope = baseEnvelope({
      documents: [documentRow({ provider_contract_ref: "sc-1" })],
      recipients: [recipientRow({ status: "SIGNED" }), automatic],
      assignments: [
        assignmentRow({ id: "a1", recipient_id: "r1", status: "SIGNED", signed_at: new Date() }),
        assignmentRow({
          id: "a-fa-1",
          recipient_id: "r-fa-1",
          status: "SENT",
          frozen_asset_snapshot: frozenFaSignerSnapshot("aisha@cashsouk.com", 1),
        }),
      ],
    });
    const markAssignmentSigned = jest.fn().mockImplementation(async (id: string) => {
      const row = envelope.assignments.find((assignment) => assignment.id === id);
      if (row) row.status = "SIGNED";
    });
    const autoSign = jest.fn().mockResolvedValue({ alreadySigned: false });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(envelope),
        markAssignmentSigned,
        markRecipientViewedIfUnset: jest.fn(),
        recordAutoSignAttempt: jest.fn().mockResolvedValue(undefined),
        recordSignedDocument: jest.fn(),
        updateRecipientStatus: jest.fn(),
        updateDocumentStatus: jest.fn(),
        updateEnvelopeStatusIfCurrent: jest.fn().mockResolvedValue(true),
      },
      {
        name: "test",
        getContractDetails: jest.fn().mockResolvedValue({
          documentState: 2,
          signers: [
            { email: "signer@example.com", status: "SIGNED", name: "Ali" },
            { email: "aisha@cashsouk.com", status: "SIGNED", name: "Aisha" },
          ],
        }),
        fetchSignedDocument: jest.fn(),
        createDocumentContract: jest.fn(),
        startSignerSession: jest.fn(),
        autoSign,
      }
    );

    await service.syncEnvelopeFromProvider("env-1");

    expect(autoSign).toHaveBeenCalledTimes(1);
    expect(markAssignmentSigned).toHaveBeenCalledWith("a-fa-1");
    expect(markAssignmentSigned).not.toHaveBeenCalledWith("a1");
  });

  it("treats alreadySigned as reconciliation instead of a failed retry", async () => {
    const automatic = recipientRow({
      id: "r-fa-1",
      role_key: "FA",
      role_label: "Facility Agreement — signer 1 of 2",
      name: "Aisha Rahman",
      email: "aisha@cashsouk.com",
      execution_mode: "AUTOMATIC",
      delivery_mode: "INTERNAL",
      kyc_required: false,
      routing_order: 1001,
      status: "SENT",
    });
    const envelope = baseEnvelope({
      documents: [documentRow({ provider_contract_ref: "sc-1" })],
      recipients: [recipientRow({ status: "SIGNED" }), automatic],
      assignments: [
        assignmentRow({ id: "a1", recipient_id: "r1", status: "SIGNED", signed_at: new Date() }),
        assignmentRow({
          id: "a-fa-1",
          recipient_id: "r-fa-1",
          status: "SENT",
          frozen_asset_snapshot: frozenFaSignerSnapshot("aisha@cashsouk.com", 1),
        }),
      ],
    });
    const markAssignmentSigned = jest.fn().mockImplementation(async (id: string) => {
      const row = envelope.assignments.find((assignment) => assignment.id === id);
      if (row) row.status = "SIGNED";
    });
    const recordAutoSignAttempt = jest.fn().mockResolvedValue(undefined);
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(envelope),
        markAssignmentSigned,
        markRecipientViewedIfUnset: jest.fn(),
        recordAutoSignAttempt,
        recordSignedDocument: jest.fn(),
        updateRecipientStatus: jest.fn(),
        updateDocumentStatus: jest.fn(),
        updateEnvelopeStatusIfCurrent: jest.fn().mockResolvedValue(true),
      },
      {
        name: "test",
        getContractDetails: jest.fn().mockResolvedValue({
          documentState: 2,
          signers: [
            { email: "signer@example.com", status: "SIGNED", name: "Ali" },
            { email: "aisha@cashsouk.com", status: "PENDING", name: "Aisha" },
          ],
        }),
        fetchSignedDocument: jest.fn(),
        createDocumentContract: jest.fn(),
        startSignerSession: jest.fn(),
        autoSign: jest.fn().mockResolvedValue({ alreadySigned: true }),
      }
    );

    await service.syncEnvelopeFromProvider("env-1");

    expect(markAssignmentSigned).toHaveBeenCalledWith("a-fa-1");
    expect(recordAutoSignAttempt).toHaveBeenCalledWith("a-fa-1", { error: null, increment: true });
  });

  it("resumes DELIVERING without re-registering provider contracts", async () => {
    const envelope = baseEnvelope({
      status: "DRAFT",
      sent_at: null,
      send_phase: "DELIVERING",
      documents: [documentRow({ provider_contract_ref: null })],
      recipients: [recipientRow({ status: "DRAFT" })],
      assignments: [assignmentRow()],
    });
    const markEnvelopeSent = jest.fn().mockResolvedValue(undefined);
    const createDocumentContract = jest.fn();
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(envelope),
        findApplicationContext: jest.fn().mockResolvedValue({
          id: "app-1",
          status: "CONTRACT_SENT",
          issuer_organization_id: "org-1",
          contract_id: "contract-1",
          product_id: "p1",
          product_version: 1,
          invoices: [],
          issuer_organization: { owner_user_id: "issuer-1" },
          supporting_documents: [],
        }),
        markEnvelopeSent,
        setRecipientAccessToken: jest.fn().mockResolvedValue(undefined),
        setRecipientEmailDeliveryStatus: jest.fn().mockResolvedValue(undefined),
      },
      {
        name: "test",
        createDocumentContract,
        getContractDetails: jest.fn(),
        fetchSignedDocument: jest.fn(),
        startSignerSession: jest.fn(),
      }
    );
    stubSendPrerequisites(service);

    await service.continueEnvelopeSend("env-1", { userId: "admin-1", portal: "ADMIN" as never });

    expect(createDocumentContract).not.toHaveBeenCalled();
    expect(markEnvelopeSent).toHaveBeenCalled();
  });

  it("retries failed invitation emails without re-registering the provider contract", async () => {
    process.env.ISSUER_URL = "https://issuer.example.test";
    const envelope = baseEnvelope({
      status: "SENT",
      send_phase: "SENT",
      send_error: "One or more signing invitation emails failed. Retry delivery.",
      documents: [documentRow({ provider_contract_ref: "sc-1" })],
      recipients: [
        recipientRow({
          status: "SENT",
          metadata: { email_delivery: { status: "failed" } },
        }),
      ],
      assignments: [assignmentRow()],
    });
    const setRecipientEmailDeliveryStatus = jest.fn().mockResolvedValue(undefined);
    const createDocumentContract = jest.fn();
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(envelope),
        setRecipientAccessToken: jest.fn().mockResolvedValue(undefined),
        setRecipientEmailDeliveryStatus,
      },
      {
        name: "test",
        createDocumentContract,
        getContractDetails: jest.fn(),
        fetchSignedDocument: jest.fn(),
        startSignerSession: jest.fn(),
      }
    );

    await service.retryEnvelopeDelivery("env-1", { userId: "admin-1", portal: "ADMIN" as never });

    expect(createDocumentContract).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalled();
    expect(setRecipientEmailDeliveryStatus).toHaveBeenCalledWith("r1", "sent", null);
  });

  it("logs one SIGNING_DOCUMENT_SIGNED per newly signed document assignment", async () => {
    const envelope = baseEnvelope({
      documents: [
        documentRow({ id: "d1", name: "Facility Agreement", provider_contract_ref: "sc-1" }),
        documentRow({
          id: "d2",
          name: "Deed of Assignment",
          template_ref: "deed_of_assignment",
          provider_contract_ref: "sc-2",
        }),
      ],
      recipients: [recipientRow({ name: "Ali", role_label: "Issuer director" })],
      assignments: [
        assignmentRow({ id: "a1", document_id: "d1" }),
        assignmentRow({ id: "a2", document_id: "d2" }),
      ],
    });
    const markAssignmentSigned = jest.fn().mockImplementation(async (id: string) => {
      const assignment = envelope.assignments.find((row) => row.id === id);
      if (!assignment || assignment.status === "SIGNED") return false;
      assignment.status = "SIGNED";
      return true;
    });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(envelope),
        markAssignmentSigned,
        markRecipientViewedIfUnset: jest.fn(),
        updateRecipientStatus: jest.fn(),
        updateDocumentStatus: jest.fn(),
        updateEnvelopeStatusIfCurrent: jest.fn().mockResolvedValue(false),
        recordSignedDocument: jest.fn(),
      },
      {
        name: "test",
        getContractDetails: jest.fn().mockResolvedValue({
          documentState: 2,
          signers: [{ email: "signer@example.com", status: "SIGNED", name: "Ali" }],
        }),
        fetchSignedDocument: jest.fn(),
        createDocumentContract: jest.fn(),
        startSignerSession: jest.fn(),
      }
    );

    await service.syncEnvelopeFromProvider("env-1", { context: webhookAuditContext() });
    await service.syncEnvelopeFromProvider("env-1", { context: webhookAuditContext() });

    const signedLogs = logActivity.mock.calls
      .map(([params]) => params)
      .filter((params) => params?.eventType === ApplicationLogEventType.SIGNING_DOCUMENT_SIGNED);
    expect(signedLogs).toHaveLength(2);
    expect(signedLogs.map((params) => params?.metadata)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          document_id: "d1",
          document_name: "Facility Agreement",
          signer_name: "Ali",
          execution_mode: "MANUAL",
        }),
        expect.objectContaining({
          document_id: "d2",
          document_name: "Deed of Assignment",
          signer_name: "Ali",
          execution_mode: "MANUAL",
        }),
      ])
    );
    expect(JSON.stringify(signedLogs)).not.toMatch(/signer@example\.com|820508105871/i);
  });

  it("logs a guarantor document signature without email or IC", async () => {
    const envelope = baseEnvelope({
      documents: [documentRow({ provider_contract_ref: "sc-1", name: "Personal Guarantee" })],
      recipients: [
        recipientRow({
          role_key: "guarantor",
          role_label: "Guarantor",
          name: "Siti",
          email: "siti@co.my",
          ic_number: "900101145678",
        }),
      ],
      assignments: [assignmentRow()],
    });
    const markAssignmentSigned = jest.fn().mockImplementation(async (id: string) => {
      const assignment = envelope.assignments.find((row) => row.id === id);
      if (!assignment || assignment.status === "SIGNED") return false;
      assignment.status = "SIGNED";
      return true;
    });
    const service = createService(
      {
        findById: jest.fn().mockResolvedValue(envelope),
        markAssignmentSigned,
        markRecipientViewedIfUnset: jest.fn(),
        updateRecipientStatus: jest.fn(),
        updateDocumentStatus: jest.fn(),
        updateEnvelopeStatusIfCurrent: jest.fn().mockResolvedValue(false),
        recordSignedDocument: jest.fn(),
      },
      {
        name: "test",
        getContractDetails: jest.fn().mockResolvedValue({
          documentState: 2,
          signers: [{ email: "siti@co.my", status: "SIGNED", name: "Siti" }],
        }),
        fetchSignedDocument: jest.fn(),
        createDocumentContract: jest.fn(),
        startSignerSession: jest.fn(),
      }
    );

    await service.syncEnvelopeFromProvider("env-1");

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        portal: ActivityPortal.ISSUER,
        eventType: ApplicationLogEventType.SIGNING_DOCUMENT_SIGNED,
        remark: "Siti signed Personal Guarantee as Guarantor.",
        metadata: expect.objectContaining({
          role_key: "guarantor",
          signer_name: "Siti",
          execution_mode: "MANUAL",
        }),
      })
    );
    expect(JSON.stringify(logActivity.mock.calls)).not.toMatch(/siti@co\.my|900101145678/i);
  });
});
