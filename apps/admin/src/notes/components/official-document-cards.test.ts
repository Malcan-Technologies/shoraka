import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(relative: string): string {
  return readFileSync(join(__dirname, relative), "utf8");
}

describe("admin official document cards", () => {
  it("shows View, Download and Regenerate / Reissue for READY certificates", () => {
    const card = source("../components/investment-note-certificate-card.tsx");
    expect(card).toContain("View");
    expect(card).toContain("Download");
    expect(card).toContain("Regenerate / Reissue");
    expect(card).toContain("Version {payload.version}");
    expect(card).toContain(
      "Generate a new version using the latest Document Authorisation settings?"
    );
    expect(card).toContain("useReissueAdminInvestmentNoteCertificate");
  });

  it("shows View, Download and Regenerate / Reissue for READY receipts", () => {
    const card = source("../components/settlement-hibah-receipt-card.tsx");
    expect(card).toContain("View");
    expect(card).toContain("Download");
    expect(card).toContain("Regenerate / Reissue");
    expect(card).toContain("Version {payload.version}");
    expect(card).toContain("useReissueAdminSettlementHibahReceipt");
  });
});
