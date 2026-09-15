jest.mock("../applications/logs/service", () => ({
  logApplicationActivity: jest.fn().mockResolvedValue(undefined),
}));

import { ActivityPortal, ApplicationLogEventType } from "../applications/logs/types";
import { logApplicationActivity } from "../applications/logs/service";
import {
  buildSigningDocumentSignedMetadata,
  markAssignmentSignedAndLog,
} from "./document-signed-activity";
import type { SigningEnvelopeWithGraph } from "./mapper";

const logActivity = logApplicationActivity as jest.MockedFunction<typeof logApplicationActivity>;

function parties(overrides: {
  recipient?: Partial<SigningEnvelopeWithGraph["recipients"][number]>;
  document?: Partial<SigningEnvelopeWithGraph["documents"][number]>;
  assignment?: Partial<SigningEnvelopeWithGraph["assignments"][number]>;
} = {}) {
  const envelope = {
    id: "env-1",
    application_id: "app-1",
    contract_id: "contract-1",
    invoice_id: null,
    title: "Facility offer signing package",
    documents: [
      {
        id: "d1",
        name: "Facility Agreement",
        provider_contract_ref: "sc-1",
        ...overrides.document,
      },
    ],
    recipients: [
      {
        id: "r1",
        name: "Ali",
        email: "ali@co.my",
        ic_number: "820508105871",
        role_key: "issuer_director",
        role_label: "Issuer director",
        execution_mode: "MANUAL",
        ...overrides.recipient,
      },
    ],
    assignments: [
      {
        id: "a1",
        document_id: "d1",
        recipient_id: "r1",
        status: "PENDING",
        ...overrides.assignment,
      },
    ],
  } as unknown as SigningEnvelopeWithGraph;
  return {
    envelope,
    assignment: envelope.assignments[0]!,
    recipient: envelope.recipients[0]!,
    document: envelope.documents[0]!,
  };
}

describe("signing document signed activity", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stores display-safe metadata without email or IC", () => {
    const metadata = buildSigningDocumentSignedMetadata(parties());
    expect(metadata).toEqual(
      expect.objectContaining({
        envelope_id: "env-1",
        assignment_id: "a1",
        document_id: "d1",
        recipient_id: "r1",
        document_name: "Facility Agreement",
        signer_name: "Ali",
        role_key: "issuer_director",
        role_label: "Issuer director",
        execution_mode: "MANUAL",
        actorName: "Ali",
        contract_id: "contract-1",
      })
    );
    expect(JSON.stringify(metadata)).not.toMatch(/ali@co\.my|820508105871|ic_number|email/i);
  });

  it("treats automatic CashSouk signatures as system activity", async () => {
    const signed = parties({
      recipient: {
        name: "Aisha Rahman",
        email: "aisha@cashsouk.com",
        ic_number: "850101015555",
        role_key: "FA",
        role_label: "Facility Agreement — signer 1 of 2",
        execution_mode: "AUTOMATIC",
      },
    });
    const metadata = buildSigningDocumentSignedMetadata(signed);
    expect(metadata.execution_mode).toBe("AUTOMATIC");
    expect(metadata.actorName).toBeUndefined();
    expect(JSON.stringify(metadata)).not.toMatch(/aisha@cashsouk\.com|850101015555/i);

    await markAssignmentSignedAndLog({
      repo: { markAssignmentSigned: jest.fn().mockResolvedValue(true) },
      parties: signed,
    });
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        portal: null,
        eventType: ApplicationLogEventType.SIGNING_DOCUMENT_SIGNED,
        metadata: expect.objectContaining({ execution_mode: "AUTOMATIC" }),
      })
    );
  });

  it("logs once on the first SIGNED transition and skips repeats", async () => {
    const markAssignmentSigned = jest
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(undefined);
    const signed = parties();

    await expect(
      markAssignmentSignedAndLog({ repo: { markAssignmentSigned }, parties: signed })
    ).resolves.toBe(true);
    await expect(
      markAssignmentSignedAndLog({ repo: { markAssignmentSigned }, parties: signed })
    ).resolves.toBe(false);
    await expect(
      markAssignmentSignedAndLog({ repo: { markAssignmentSigned }, parties: signed })
    ).resolves.toBe(true);

    expect(logActivity).toHaveBeenCalledTimes(2);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        portal: ActivityPortal.ISSUER,
        eventType: ApplicationLogEventType.SIGNING_DOCUMENT_SIGNED,
        remark: "Ali signed Facility Agreement as Issuer director.",
      })
    );
  });
});
