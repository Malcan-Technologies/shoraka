import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("admin RegTank people links", () => {
  const table = read("components/admin/director-shareholder-table.tsx");
  const records = read("components/admin/regtank-records-control.tsx");
  const page = read("organizations/components/organization-detail-page.tsx");
  const peopleCard = read("organizations/components/organization-person-card.tsx");
  const quickLinks = read("organizations/components/organization-quick-links-card.tsx");

  it("uses a compact RegTank record count and View popover in the people table", () => {
    expect(table).toContain("RegtankRecordsControl");
    expect(table).toContain("overflow-hidden rounded-xl border");
    expect(table).toContain("min-w-[11.5rem] w-[13rem]");
    expect(table).toContain("w-[11rem]");
    expect(table).not.toContain("getRegtankLink");
    expect(records).toContain("getRegtankColumnDisplayRows");
    expect(records).toContain("PopoverTrigger");
    expect(records).toContain("RegTank records");
    expect(records).toContain("1 record");
    expect(records).toContain("aria-label={`View ${recordLabel} in RegTank`}");
    expect(records).toContain("href={row.url}");
    expect(records).toContain("ArrowTopRightOnSquareIcon");
  });

  it("keeps organization detail Open in RegTank available from portal URL or COD", () => {
    expect(page).toContain("headerRegtankUrl");
    expect(page).toContain("getRegtankCorporateOnboardingUrl(org.codRequestId)");
    expect(page).toContain("Open in RegTank");
    expect(peopleCard).toContain("RegtankRecordsControl");
    expect(quickLinks).toContain("getRegtankCorporateOnboardingUrl(org.codRequestId)");
  });
});
