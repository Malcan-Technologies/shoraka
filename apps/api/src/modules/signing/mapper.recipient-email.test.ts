import { mapSigningEnvelopeToDto, type SigningEnvelopeWithGraph } from "./mapper";

function envelope(overrides: Partial<SigningEnvelopeWithGraph> = {}): SigningEnvelopeWithGraph {
  return {
    id: "env-1",
    application_id: "app-1",
    contract_id: null,
    invoice_id: null,
    title: "Facility",
    status: "SENT",
    expires_at: null,
    sent_at: new Date("2026-09-01T00:00:00.000Z"),
    completed_at: null,
    created_at: new Date("2026-09-01T00:00:00.000Z"),
    updated_at: new Date("2026-09-01T00:00:00.000Z"),
    documents: [],
    assignments: [],
    recipients: [
      {
        id: "rec-1",
        envelope_id: "env-1",
        role_key: "issuer_director",
        role_label: "Director",
        name: "Ali",
        email: "old-person@co.my",
        routing_order: 1,
        status: "SENT",
        completed_at: null,
        viewed_at: null,
        execution_mode: "MANUAL",
        delivery_mode: "EMAIL",
        metadata: {},
      } as SigningEnvelopeWithGraph["recipients"][number],
    ],
    ...overrides,
  } as SigningEnvelopeWithGraph;
}

describe("sent signing recipient snapshots stay frozen", () => {
  it("keeps the stored recipient email after Person Email later changes", () => {
    const dto = mapSigningEnvelopeToDto(envelope());
    expect(dto.recipients).toEqual([
      expect.objectContaining({
        id: "rec-1",
        email: "old-person@co.my",
      }),
    ]);
    expect(dto.recipients[0]?.email).not.toBe("new-person@co.my");
  });

  it("relabels Shoraka automatic signers as authorised signatory or witness", () => {
    const dto = mapSigningEnvelopeToDto(
      envelope({
        recipients: [
          {
            id: "rec-auto",
            envelope_id: "env-1",
            role_key: "FA",
            role_label: "Max Cheng",
            name: "Max Cheng",
            email: "max@cashsouk.com",
            routing_order: 2,
            status: "SIGNED",
            completed_at: null,
            viewed_at: null,
            execution_mode: "AUTOMATIC",
            delivery_mode: "INTERNAL",
            metadata: {},
          } as SigningEnvelopeWithGraph["recipients"][number],
        ],
        assignments: [
          {
            id: "asg-1",
            envelope_id: "env-1",
            document_id: "doc-1",
            recipient_id: "rec-auto",
            required: true,
            action: "SIGN",
            status: "SIGNED",
            signed_at: null,
            last_auto_sign_error: null,
            auto_sign_attempt_count: 1,
            frozen_asset_snapshot: {
              documentKind: "FA",
              signingPersonId: "sp-max",
              officerName: "Max Cheng",
              designation: "Chief Technology Officer",
              identityNumber: "850101015555",
              signingEmail: "max@cashsouk.com",
              signatureS3Key: "operator-profile/signing-signatures/max.png",
              signatureSha256: "aa".repeat(32),
              signatureWidthPx: 80,
              signatureHeightPx: 40,
              signatureByteSize: 9,
              signKeyword: "CASHSOUK_FA_SPMAX_SIGN",
              placements: [
                {
                  roleKey: "FA_INVESTOR",
                  slotIndex: 1,
                  keyword: "CASHSOUK_FA_SPMAX_SIGN",
                  status: "SIGNED",
                },
              ],
            },
          } as SigningEnvelopeWithGraph["assignments"][number],
        ],
      })
    );
    expect(dto.recipients[0]).toEqual(
      expect.objectContaining({
        name: "Max Cheng",
        role_label: "Authorised Signatory",
      })
    );
  });
});
