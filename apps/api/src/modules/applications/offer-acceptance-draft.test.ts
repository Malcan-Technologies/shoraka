import { patchOfferAcceptance } from "./offer-acceptance";

const DRAFT = {
  submitted_by_user_id: "user_1",
  submitted_at: "2026-08-21T00:00:00.000Z",
  parties: [
    {
      key: "issuer",
      entity_kind: "ISSUER" as const,
      representatives: [
        {
          name: "Ali",
          email: "ali@co.my",
          ic_number: "820508105871",
          capacity: "director" as const,
          person_match_key: "820508105871",
        },
      ],
    },
  ],
};

describe("patchOfferAcceptance authorised-parties draft", () => {
  it("saves a draft without changing status", () => {
    const updated = patchOfferAcceptance(
      {
        offered_facility: 1,
        offer_acceptance: { status: "PENDING_ISSUER" },
      },
      { status: "PENDING_ISSUER", authorized_parties_draft: DRAFT }
    );
    const acceptance = (updated.offer_acceptance as { status: string; authorized_parties_draft: unknown });
    expect(acceptance.status).toBe("PENDING_ISSUER");
    expect(acceptance.authorized_parties_draft).toEqual(DRAFT);
  });

  it("clears the draft on null without dropping submitted parties", () => {
    const updated = patchOfferAcceptance(
      {
        offer_acceptance: {
          status: "PENDING_ISSUER",
          authorized_parties: DRAFT,
          authorized_parties_draft: DRAFT,
        },
      },
      { status: "PENDING_ADMIN_REVIEW", authorized_parties: DRAFT, authorized_parties_draft: null }
    );
    const acceptance = updated.offer_acceptance as Record<string, unknown>;
    expect(acceptance.status).toBe("PENDING_ADMIN_REVIEW");
    expect(acceptance.authorized_parties).toEqual(DRAFT);
    expect(acceptance.authorized_parties_draft).toBeUndefined();
  });
});
