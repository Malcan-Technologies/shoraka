import fs from "node:fs";
import path from "node:path";

const servicePath = path.join(__dirname, "ctos-report-service.ts");
const source = fs.readFileSync(servicePath, "utf8");

function functionChunk(name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const next = source.indexOf("export async function ", start + `export async function ${name}`.length);
  return source.slice(start, next === -1 ? source.length : next);
}

describe("CTOS report service onboarding audit retirement", () => {
  const insertFns = [
    "fetchAndInsertCtosReport",
    "fetchAndInsertCtosReportForAdminOrg",
    "fetchAndInsertCtosSubjectReport",
    "fetchAndInsertCtosSubjectReportForAdminOrg",
  ] as const;

  it("keeps append-only ctos_reports inserts on every fetch path", () => {
    expect(source.match(/prisma\.ctosReport\.create\(/g)?.length).toBe(4);
    expect(source).not.toMatch(/prisma\.ctosReport\.(update|upsert)/);
    for (const name of insertFns) {
      expect(functionChunk(name)).toMatch(/prisma\.ctosReport\.create\(/);
    }
  });

  it("does not write CTOS_REPORT_RECEIVED on org, onboarding-approval, or subject fetch", () => {
    expect(source).not.toMatch(/writeCtosReportReceivedAudit/);
    expect(source).not.toMatch(/writeOnboardingAuditLog/);
    expect(source).not.toMatch(/CTOS_REPORT_RECEIVED/);
    for (const name of insertFns) {
      expect(functionChunk(name)).not.toMatch(/onboardingAuditLog/);
      expect(functionChunk(name)).not.toMatch(/eventType:\s*"CTOS_REPORT_RECEIVED"/);
    }
  });

  it("repeated fetch still inserts another report row rather than updating", () => {
    for (const name of insertFns) {
      const chunk = functionChunk(name);
      expect(chunk).toMatch(/prisma\.ctosReport\.create\(/);
      expect(chunk).not.toMatch(/prisma\.ctosReport\.update/);
    }
  });
});
