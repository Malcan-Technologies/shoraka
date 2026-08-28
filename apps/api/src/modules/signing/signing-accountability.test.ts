/**
 * Signing accountability: expiry, decline vs void, null creator, viewed_at, webhook actor.
 */
jest.mock("../../lib/prisma", () => ({
  prisma: {
    contract: { findUnique: jest.fn(), update: jest.fn() },
    invoice: { findUnique: jest.fn(), update: jest.fn() },
    signingDocument: { findFirst: jest.fn() },
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
  resolveSigningKycStatus: jest.fn().mockResolvedValue("PENDING"),
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

jest.mock("../../lib/s3/client", () => ({
  getS3ObjectBuffer: jest.fn(),
  putS3ObjectBuffer: jest.fn(),
}));

import { prisma } from "../../lib/prisma";
import { logApplicationActivity } from "../applications/logs/service";
import { applicationService } from "../applications/service";
import { webhookAuditContext, systemAuditContext } from "../../lib/audit";
import { ApplicationLogEventType } from "../applications/logs/types";
import { SigningService } from "./service";
import type { SigningProvider } from "./provider/adapter";
import type { SigningRepository } from "./repository";
import type { SigningEnvelopeWithGraph } from "./mapper";

const logActivity = logApplicationActivity as jest.MockedFunction<typeof logApplicationActivity>;
const finalizeOffer = applicationService.finalizeOfferAfterEnvelopeCompletion as jest.Mock;

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
    created_by_user_id: null,
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

describe("signing accountability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.contract.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);
  });

  it("expires an envelope with SYSTEM_JOB source and logs even when created_by_user_id is null", async () => {
    const envelope = baseEnvelope({ created_by_user_id: null, status: "SENT" });
    const repo: Partial<SigningRepository> = {
      findById: jest.fn().mockResolvedValue(envelope),
      updateEnvelopeStatusIfCurrent: jest.fn().mockResolvedValue(true),
    };
    const service = createService(repo);
    const context = systemAuditContext({ correlationId: "cron:signing-envelope-expiry" });

    const closed = await service.expireEnvelope(envelope.id, { context });

    expect(closed).toBe(true);
    expect(repo.updateEnvelopeStatusIfCurrent).toHaveBeenCalledWith(
      "env-1",
      "SENT",
      "EXPIRED",
      false
    );
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        applicationId: "app-1",
        eventType: ApplicationLogEventType.SIGNING_PACKAGE_EXPIRED,
        portal: null,
        context,
      })
    );
    expect(logActivity).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: ApplicationLogEventType.SIGNING_PACKAGE_VOIDED })
    );
  });

  it("logs VOIDED only for an explicit void, including envelopes without a creator", async () => {
    const envelope = baseEnvelope({ created_by_user_id: null, status: "SENT" });
    const repo: Partial<SigningRepository> = {
      findById: jest.fn().mockResolvedValue(envelope),
      voidEnvelope: jest.fn().mockResolvedValue(undefined),
    };
    const service = createService(repo);

    await service.voidEnvelope(envelope.id, "admin cancelled");

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        eventType: ApplicationLogEventType.SIGNING_PACKAGE_VOIDED,
        metadata: expect.objectContaining({ void_reason: "admin cancelled" }),
      })
    );
    expect(logActivity).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: ApplicationLogEventType.SIGNING_PACKAGE_DECLINED })
    );
  });

  it("logs SIGNING_PACKAGE_DECLINED from provider reject, not VOIDED", async () => {
    const envelope = baseEnvelope({
      created_by_user_id: null,
      documents: [
        {
          id: "d1",
          envelope_id: "env-1",
          name: "Offer",
          description: null,
          source: "GENERATED_OFFER_LETTER",
          order: 0,
          required: true,
          status: "PENDING",
          provider_contract_ref: "sc-1",
          unsigned_s3_key: "u",
          signed_s3_key: null,
          signed_file_sha256: null,
          metadata: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      recipients: [
        {
          id: "r1",
          envelope_id: "env-1",
          role_key: "issuer_director",
          role_label: "Director",
          application_guarantor_id: null,
          name: "Ali",
          email: "ali@co.my",
          ic_number: null,
          routing_order: 0,
          kyc_required: true,
          status: "SENT",
          access_token_hash: null,
          access_token_expires_at: null,
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
        },
      ],
      assignments: [
        {
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
        },
      ],
    } as SigningEnvelopeWithGraph);

    const repo: Partial<SigningRepository> = {
      findById: jest.fn().mockResolvedValue(envelope),
      markAssignmentDeclined: jest.fn().mockImplementation(async () => {
        envelope.assignments[0].status = "DECLINED";
      }),
      markRecipientViewedIfUnset: jest.fn().mockResolvedValue(undefined),
      updateRecipientStatus: jest.fn().mockImplementation(async (_id, status) => {
        envelope.recipients[0].status = status;
      }),
      updateDocumentStatus: jest.fn().mockImplementation(async (_id, status) => {
        envelope.documents[0].status = status;
      }),
      updateEnvelopeStatusIfCurrent: jest.fn().mockImplementation(async (_id, _from, next) => {
        envelope.status = next;
        return true;
      }),
    };
    const provider: Partial<SigningProvider> = {
      name: "test",
      getContractDetails: jest.fn().mockResolvedValue({
        documentState: 2,
        signers: [{ email: "ali@co.my", status: "REJECTED", name: "Ali" }],
      }),
    };
    const service = createService(repo, provider);
    const context = webhookAuditContext();

    await service.syncEnvelopeFromProvider("env-1", { context });

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        eventType: ApplicationLogEventType.SIGNING_PACKAGE_DECLINED,
        context,
      })
    );
    expect(logActivity).not.toHaveBeenCalledWith(
      expect.objectContaining({ eventType: ApplicationLogEventType.SIGNING_PACKAGE_VOIDED })
    );
  });

  it("finalizes a completed envelope even when created_by_user_id is null", async () => {
    const envelope = baseEnvelope({
      created_by_user_id: null,
      status: "IN_PROGRESS",
      documents: [
        {
          id: "d1",
          envelope_id: "env-1",
          name: "Offer",
          description: null,
          source: "GENERATED_OFFER_LETTER",
          order: 0,
          required: true,
          status: "PENDING",
          provider_contract_ref: "sc-1",
          unsigned_s3_key: "u",
          signed_s3_key: "applications/app-1/signed.pdf",
          signed_file_sha256: "abc",
          metadata: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      recipients: [
        {
          id: "r1",
          envelope_id: "env-1",
          role_key: "issuer_director",
          role_label: "Director",
          application_guarantor_id: null,
          name: "Ali",
          email: "ali@co.my",
          ic_number: null,
          routing_order: 0,
          kyc_required: true,
          status: "SENT",
          access_token_hash: null,
          access_token_expires_at: null,
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
        },
      ],
      assignments: [
        {
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
        },
      ],
    } as SigningEnvelopeWithGraph);

    const repo: Partial<SigningRepository> = {
      findById: jest.fn().mockResolvedValue(envelope),
      markAssignmentSigned: jest.fn().mockImplementation(async () => {
        envelope.assignments[0].status = "SIGNED";
      }),
      markRecipientViewedIfUnset: jest.fn().mockResolvedValue(undefined),
      updateRecipientStatus: jest.fn().mockImplementation(async (_id, status) => {
        envelope.recipients[0].status = status;
      }),
      updateDocumentStatus: jest.fn().mockImplementation(async (_id, status) => {
        envelope.documents[0].status = status;
      }),
      updateEnvelopeStatusIfCurrent: jest.fn().mockImplementation(async (_id, _from, next) => {
        envelope.status = next;
        return true;
      }),
      recordSignedDocument: jest.fn(),
    };
    const provider: Partial<SigningProvider> = {
      name: "test",
      getContractDetails: jest.fn().mockResolvedValue({
        documentState: 4,
        signers: [{ email: "ali@co.my", status: "SIGNED", name: "Ali" }],
      }),
    };
    const service = createService(repo, provider);

    await service.syncEnvelopeFromProvider("env-1", { context: webhookAuditContext() });

    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        eventType: ApplicationLogEventType.SIGNING_PACKAGE_COMPLETED,
      })
    );
    expect(finalizeOffer).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-1",
        initiatedByUserId: null,
        signedFileSha256: "abc",
      })
    );
  });

  it("records viewed_at from the external link and from provider detail", async () => {
    const recipient = {
      id: "r1",
      envelope_id: "env-1",
      role_key: "issuer_director",
      role_label: "Director",
      application_guarantor_id: null,
      name: "Ali",
      email: "ali@co.my",
      ic_number: null,
      routing_order: 0,
      kyc_required: true,
      status: "SENT",
      access_token_hash: "hash",
      access_token_expires_at: new Date(Date.now() + 60_000),
      access_code_verified_at: null,
      sent_at: new Date(),
      viewed_at: null,
      completed_at: null,
      declined_at: null,
      decline_reason: null,
      last_reminder_at: null,
      metadata: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const envelope = baseEnvelope({
      recipients: [recipient],
      documents: [],
      assignments: [],
    } as SigningEnvelopeWithGraph);
    const viewedAt = new Date("2026-08-29T04:00:00.000Z");
    const markRecipientViewedIfUnset = jest.fn().mockResolvedValue(undefined);
    const repo: Partial<SigningRepository> = {
      findById: jest.fn().mockResolvedValue(envelope),
      findEnvelopeByRecipientAccessToken: jest.fn().mockResolvedValue({
        envelope,
        recipientId: "r1",
      }),
      markRecipientViewedIfUnset,
      markAssignmentSigned: jest.fn(),
      updateRecipientStatus: jest.fn(),
      updateDocumentStatus: jest.fn(),
      updateEnvelopeStatusIfCurrent: jest.fn(),
    };
    const syncEnvelope = baseEnvelope({
      documents: [
        {
          id: "d1",
          envelope_id: "env-1",
          name: "Offer",
          description: null,
          source: "GENERATED_OFFER_LETTER",
          order: 0,
          required: true,
          status: "PENDING",
          provider_contract_ref: "sc-1",
          unsigned_s3_key: "u",
          signed_s3_key: null,
          signed_file_sha256: null,
          metadata: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      recipients: [{ ...recipient, access_code_verified_at: new Date() }],
      assignments: [
        {
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
        },
      ],
    } as SigningEnvelopeWithGraph);
    (repo.findById as jest.Mock).mockImplementation(async () => syncEnvelope);
    const provider: Partial<SigningProvider> = {
      name: "test",
      getContractDetails: jest.fn().mockResolvedValue({
        documentState: 0,
        signers: [{ email: "ali@co.my", status: "PENDING", name: "Ali", viewedAt }],
      }),
    };
    const service = createService(repo, provider);

    await service.getEnvelopeForExternalToken("token");
    expect(markRecipientViewedIfUnset).toHaveBeenCalledWith("r1");

    await service.syncEnvelopeFromProvider("env-1");
    expect(markRecipientViewedIfUnset).toHaveBeenCalledWith("r1", viewedAt);
  });

  it("keeps the Admin send path on ADMIN portal with the request actor", async () => {
    const envelope = baseEnvelope({
      status: "DRAFT",
      created_by_user_id: "admin-1",
      documents: [],
      recipients: [],
      assignments: [],
    });
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
      markEnvelopeSent: jest.fn(),
      markDocumentSent: jest.fn(),
    };
    const service = createService(repo);
    const context = webhookAuditContext();
    jest.spyOn(service as never, "assertOfferAcceptanceAllowsSigning").mockResolvedValue(undefined as never);
    jest.spyOn(service as never, "getProductWorkflowForApplication").mockResolvedValue([] as never);
    jest.spyOn(service as never, "readSigningTemplateFromWorkflow").mockReturnValue({
      recipients: [],
      documents: [],
    } as never);
    jest.spyOn(service as never, "assertBindingsMatchApprovedSnapshot").mockReturnValue(undefined as never);
    (prisma.contract.findUnique as jest.Mock).mockResolvedValue({ offer_details: {} });

    // Sending a draft with no documents/recipients still logs SENT for the Admin actor.
    const resultPromise = service.sendEnvelope("env-1", {
      userId: "admin-1",
      portal: "ADMIN" as never,
      context,
    });
    await expect(resultPromise).resolves.toBeDefined();
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        eventType: ApplicationLogEventType.SIGNING_PACKAGE_SENT,
        portal: "ADMIN",
        context,
      })
    );
  });
});
