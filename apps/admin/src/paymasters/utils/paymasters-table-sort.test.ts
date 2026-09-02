import type { PaymasterListItem } from "@cashsouk/types";
import { paymastersSortValue } from "./paymasters-table-sort";
import { sortRowsByColumn } from "@/shared/admin-list/table-sort";

function item(overrides: Partial<PaymasterListItem> = {}): PaymasterListItem {
  return {
    id: "pm-1",
    legalName: "Alpha Co",
    registrationNumber: "111111111111",
    registrationCountry: "MY",
    entityType: "Sdn Bhd",
    verificationStatus: "UNVERIFIED",
    verifiedAt: null,
    verifiedByUserId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
    linkedIssuerCount: 1,
    linkedNoteCount: 0,
    linkedFacilityCount: 1,
    noticeCount: 0,
    lastUsedAt: "2026-09-02T00:00:00.000Z",
    latestIssuerName: "Issuer A",
    ...overrides,
  };
}

describe("paymasters table sort", () => {
  it("sorts unverified ahead of verified when descending status", () => {
    const rows = [
      item({ id: "v", legalName: "Verified Co", verificationStatus: "VERIFIED" }),
      item({ id: "u", legalName: "Unverified Co", verificationStatus: "UNVERIFIED" }),
    ];
    const sorted = sortRowsByColumn(rows, { column: "status", direction: "desc" }, paymastersSortValue);
    expect(sorted.map((row) => row.id)).toEqual(["u", "v"]);
  });

  it("sorts by facility count", () => {
    const rows = [
      item({ id: "low", linkedFacilityCount: 0, linkedNoteCount: 1 }),
      item({ id: "high", linkedFacilityCount: 2, linkedNoteCount: 1 }),
    ];
    const sorted = sortRowsByColumn(
      rows,
      { column: "facilities", direction: "desc" },
      paymastersSortValue
    );
    expect(sorted.map((row) => row.id)).toEqual(["high", "low"]);
  });
});
