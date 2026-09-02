import type { PaymasterListItem } from "@cashsouk/types";
import { paymasterVerificationLabel } from "./paymasters-table-presentation";

function item(overrides: Partial<PaymasterListItem> = {}): PaymasterListItem {
  return {
    id: "pm-1",
    legalName: "Petronas Chemical Bhd",
    registrationNumber: "123456123456",
    registrationCountry: "MY",
    entityType: "Private Limited Company (Sdn Bhd)",
    verificationStatus: "UNVERIFIED",
    verifiedAt: null,
    verifiedByUserId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    linkedIssuerCount: 1,
    linkedNoteCount: 1,
    linkedFacilityCount: 0,
    noticeCount: 1,
    lastUsedAt: "2026-09-02T00:00:00.000Z",
    latestIssuerName: "Acme Issuer",
    ...overrides,
  };
}

describe("paymaster registry presentation", () => {
  it("labels verification the same way as Paymaster Detail", () => {
    expect(paymasterVerificationLabel(item())).toBe("Unverified");
    expect(paymasterVerificationLabel(item({ verificationStatus: "VERIFIED" }))).toBe("Verified");
  });
});
