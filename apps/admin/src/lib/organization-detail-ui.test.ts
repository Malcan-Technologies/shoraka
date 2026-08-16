import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toTitleCase } from "@cashsouk/types";

const root = join(__dirname, "..");

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("admin organization detail presentation", () => {
  const page = read("app/organizations/[portal]/[id]/page.tsx");
  const table = read("components/admin/director-shareholder-table.tsx");

  it("shows parent COD in the organization RegTank area, not as a raw COD: line", () => {
    expect(page).toContain("Corporate onboarding");
    expect(page).toContain("org.codRequestId");
    expect(page).toContain("Open in RegTank");
    expect(page).not.toContain("COD: {org.codRequestId}");
  });

  it("humanises organization member roles with toTitleCase", () => {
    expect(page).toContain("toTitleCase(member.role)");
    expect(page).toContain("shrink-0 whitespace-nowrap");
    expect(page).not.toContain("member.role.toLowerCase()");
    expect(toTitleCase("ORGANIZATION_ADMIN")).toBe("Organization Admin");
    expect(toTitleCase("Organization_admin")).toBe("Organization Admin");
  });

  it("does not render Current stage on the onboarding card", () => {
    expect(page).not.toContain("Current stage");
    expect(page).not.toContain("organizationCurrentStageLabel");
  });

  it("humanises RegTank session enums without inventing labels", () => {
    expect(page).toContain("toTitleCase(org.regtankSessionStatus)");
    expect(toTitleCase("WAIT_FOR_APPROVAL")).toBe("Wait For Approval");
    expect(toTitleCase("URL_GENERATED")).toBe("Url Generated");
    expect(toTitleCase("LIVENESS_PASSED")).toBe("Liveness Passed");
    expect(toTitleCase("IN_PROGRESS")).toBe("In Progress");
  });

  it("uses balanced column mins instead of a giant table min-width", () => {
    expect(table).toContain("overflow-hidden rounded-xl border");
    expect(table).toContain("odd:bg-muted/40 hover:bg-muted");
    expect(table).not.toContain("min-w-[72rem]");
    expect(table).not.toContain('className="w-[1%] whitespace-nowrap"');
    expect(table).toContain("min-w-[11.5rem] w-[13rem]");
    expect(table).toContain("min-w-[16.5rem]");
    expect(table).toContain("w-[15rem]");
    expect(table).toContain("whitespace-nowrap");
  });

  it("uses the shared StatusBadge for people status", () => {
    expect(table).toContain("StatusBadge");
    expect(table).toContain("finalStatusToneToToken");
    expect(table).not.toContain("getFinalStatusBadgeClassName");
    expect(table).toContain('label={finalStatus.label}');
    expect(table).toContain('className="text-xs whitespace-nowrap"');
  });

  it("renders RegTank ids as a compact three-column mini-grid", () => {
    expect(table).toContain("getRegtankColumnDisplayRows");
    expect(table).toContain("grid-cols-[auto_auto_auto]");
    expect(table).toContain("font-mono text-[11px]");
    expect(table).toContain("Open");
    expect(table).not.toContain("getRegtankOnboardingViewLinks");
    expect(table).not.toContain("getRegtankScreeningLink");
  });

  it("keeps CTOS View report disabled until a report exists", () => {
    expect(table).toContain("disabled={!latestReport}");
    expect(table).toContain("h-7 px-2.5 text-xs shrink-0");
    expect(table).toContain("Last fetched: —");
  });
});
