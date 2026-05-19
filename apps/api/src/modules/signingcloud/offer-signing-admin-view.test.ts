import {
  buildOfferSigningAdminView,
  contractResignBlockedByNotes,
  noteAllowsInvoiceResign,
} from "./offer-signing-admin-view";
import { buildArchivedSigningEntry } from "./offer-resign";
import type { OfferSigningRecord } from "./types";

describe("buildOfferSigningAdminView", () => {
  const signedRecord: OfferSigningRecord = {
    provider: "signingcloud",
    status: "signed",
    initiated_at: "2026-01-01T00:00:00.000Z",
    initiated_by_user_id: "user-1",
    signer_email: "signer@example.com",
    signed_offer_letter_s3_key: "applications/app-1/offer-letters/contract-1.pdf",
    signed_file_sha256: "abc",
    completed_at: "2026-01-02T00:00:00.000Z",
  };

  it("exposes active signed offer and enables re-sign when allowed", () => {
    const view = buildOfferSigningAdminView({
      offerSigning: signedRecord,
      offerSigningHistory: [],
      offerDetails: { version: 2 },
      primaryApplicationId: "app-1",
      canResign: true,
    });
    expect(view.activeSignedOffer?.status).toBe("signed");
    expect(view.activeSignedOffer?.signedOfferLetterS3Key).toContain("contract-1.pdf");
    expect(view.canResign).toBe(true);
  });

  it("lists archived signed versions", () => {
    const archived = buildArchivedSigningEntry({
      offerSigning: signedRecord,
      offerVersion: 1,
      archivedByUserId: "admin-1",
      archivedAt: "2026-01-03T00:00:00.000Z",
    });
    const view = buildOfferSigningAdminView({
      offerSigning: null,
      offerSigningHistory: [archived],
      offerDetails: { version: 3 },
      primaryApplicationId: "app-1",
      canResign: false,
    });
    expect(view.activeSignedOffer).toBeNull();
    expect(view.archivedSignedOffers).toHaveLength(1);
    expect(view.archivedSignedOffers[0]?.status).toBe("archived");
    expect(view.canResign).toBe(false);
  });
});

describe("resign guards", () => {
  it("blocks contract re-sign when an active note exists", () => {
    expect(contractResignBlockedByNotes([{ status: "ACTIVE" }])).toBe(true);
    expect(contractResignBlockedByNotes([{ status: "DRAFT" }])).toBe(false);
  });

  it("blocks invoice re-sign for funded note statuses", () => {
    expect(noteAllowsInvoiceResign("DRAFT")).toBe(true);
    expect(noteAllowsInvoiceResign("ACTIVE")).toBe(false);
  });
});
