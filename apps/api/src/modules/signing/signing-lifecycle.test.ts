/**
 * Signing send / return / webhook lifecycle after provider-authoritative completion.
 */
jest.mock("../../lib/prisma", () => ({
  prisma: {
    contract: { findUnique: jest.fn(), update: jest.fn() },
    invoice: { findUnique: jest.fn(), update: jest.fn() },
    signingDocument: { findFirst: jest.fn() },
    signingRecipient: { update: jest.fn() },
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

jest.mock("../generated-documents/service", () => ({
  generatedDocumentsService: {
    generateDocument: jest.fn(),
  },
}));

import { prisma } from "../../lib/prisma";
import { getS3ObjectBuffer, putS3ObjectBuffer } from "../../lib/s3/client";
import { sendEmail } from "../../lib/email/ses-client";
import { generatedDocumentsService } from "../generated-documents/service";
import { applicationService } from "../applications/service";
import { ApplicationLogEventType } from "../applications/logs/types";
import { logApplicationActivity } from "../applications/logs/service";
import { SigningService } from "./service";
import type { SigningProvider } from "./provider/adapter";
import type { SigningRepository } from "./repository";
import type { SigningEnvelopeWithGraph } from "./mapper";

const logActivity = logApplicationActivity as jest.MockedFunction<typeof logApplicationActivity>;
const finalizeOffer = applicationService.finalizeOfferAfterEnvelopeCompletion as jest.Mock;
const getS3 = getS3ObjectBuffer as jest.Mock;
const generateDocument = generatedDocumentsService.generateDocument as jest.Mock;

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
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as SigningEnvelopeWithGraph["assignments"][number];
}

function createService(repo: Partial<SigningRepository>, provider?: Partial<SigningProvider>) {
  return new SigningService(
    repo as SigningRepository,
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
      documents: [documentRow({ provider_contract_ref: "sc-already" })],
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
    const envelope = baseEnvelope({
      status: "DRAFT",
      documents: [documentRow()],
      recipients: [
        recipientRow({ id: "r1", name: "Ali Bin Abu", routing_order: 0 }),
        recipientRow({ id: "r2", name: "Siti Binti Ahmad", routing_order: 1 }),
      ],
      assignments: [
        assignmentRow({ id: "a1", recipient_id: "r1" }),
        assignmentRow({ id: "a2", recipient_id: "r2" }),
      ],
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
    };
    const createDocumentContract = jest.fn().mockResolvedValue({ providerRef: "sc-new" });
    const service = createService(repo, {
      name: "test",
      createDocumentContract,
      getContractDetails: jest.fn(),
      fetchSignedDocument: jest.fn(),
      startSignerSession: jest.fn(),
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
      signers: [{ email: "signer@example.com", signset: [fieldA, fieldB] }],
    });
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
});
