import fs from "node:fs";
import path from "node:path";

const srcRoot = path.join(__dirname, "../../..");

function readSrc(relativePath: string): string {
  return fs.readFileSync(path.join(srcRoot, relativePath), "utf8");
}

function methodChunk(source: string, methodName: string, length = 8000): string {
  const start = Math.max(
    source.indexOf(`async ${methodName}(`),
    source.indexOf(`async function ${methodName}(`)
  );
  expect(start).toBeGreaterThan(-1);
  return source.slice(start, start + length);
}

describe("ApplicationReviewRemark SOT", () => {
  const schema = readSrc("../prisma/schema.prisma");
  const repository = readSrc("modules/admin/repository.ts");
  const amendments = readSrc("modules/applications/amendments/service.ts");
  const adminService = readSrc("modules/admin/service.ts");

  it("adds review_cycle and cycle-scoped uniqueness", () => {
    const start = schema.indexOf("model ApplicationReviewRemark");
    const end = schema.indexOf("model ", start + "model ApplicationReviewRemark".length);
    const model = schema.slice(start, end);
    expect(model).toMatch(/review_cycle\s+Int/);
    expect(model).toMatch(
      /@@unique\(\[application_id, review_cycle, scope, scope_key\]/
    );
    expect(model).not.toMatch(/@@unique\(\[application_id, scope, scope_key\]/);
  });

  it("remark writes are scoped to the current review cycle", () => {
    expect(repository).toMatch(/application_id_review_cycle_scope_scope_key/);
    expect(repository).toMatch(/review_cycle: reviewCycle/);
    expect(repository).toMatch(/submitted_at: null/);
  });

  it("resubmit keeps submitted remarks and only deletes leftover drafts", () => {
    const chunk = methodChunk(amendments, "resubmitApplication", 12000);
    expect(chunk).toMatch(/review_cycle: previousCycle/);
    expect(chunk).toMatch(/submitted_at: null/);
    expect(chunk).toMatch(/APPLICATION_RESUBMITTED/);
    expect(chunk).not.toMatch(/amendment_remarks/);
    expect(chunk).not.toMatch(/applicationLog\.create/);
  });

  it("resubmit comparison uses ApplicationRevision + ApplicationReviewRemark only", () => {
    const chunk = methodChunk(adminService, "getResubmitComparisonSnapshots", 5000);
    expect(chunk).toMatch(/applicationRevision\.findFirst/);
    expect(chunk).toMatch(/applicationReviewRemark\.findMany/);
    expect(chunk).toMatch(/review_cycle: prevCycle/);
    expect(chunk).not.toMatch(/applicationLog/);
    expect(chunk).not.toMatch(/applicationAuditLog/);
  });

  it("loadAmendmentRemarks and allowed sections use current cycle", () => {
    expect(amendments).toMatch(/review_cycle: reviewCycle/);
    expect(amendments).toMatch(/loadAmendmentRemarks/);
  });

  it("next cycle can reuse the same scope and scope_key", () => {
    expect(repository).toMatch(/application_id_review_cycle_scope_scope_key/);
    expect(schema).toMatch(/@@unique\(\[application_id, review_cycle, scope, scope_key\]/);
  });
});
