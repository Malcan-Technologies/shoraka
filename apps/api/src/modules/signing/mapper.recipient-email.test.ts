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
});
