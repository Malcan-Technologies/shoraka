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

  it("uses a horizontal overflow container and a table minimum width", () => {
    expect(table).toContain("overflow-x-auto");
    expect(table).toContain("min-w-[72rem]");
  });

  it("keeps status badges on one line", () => {
    expect(table).toMatch(/className=\{`whitespace-nowrap border-transparent text-\[11px\]/);
  });

  it("renders RegTank request ids separately from screening", () => {
    expect(table).toContain("getRegtankColumnDisplayRows");
    expect(table).toContain("font-mono text-xs");
    expect(table).toContain('row.kind === "screening"');
    expect(table).toMatch(/\n\s+Open\n/);
    expect(table).not.toContain("getRegtankOnboardingViewLinks");
    expect(table).not.toContain("getRegtankScreeningLink");
  });

  it("does not wrap Share % or CTOS action buttons", () => {
    expect(table).toContain('<TableHead className="whitespace-nowrap">Share %</TableHead>');
    expect(table).toContain("whitespace-nowrap tabular-nums");
    expect(table).toContain("flex items-center gap-2 whitespace-nowrap");
    expect(table).toContain('className="h-9 shrink-0"');
  });
});
