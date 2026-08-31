import { readFileSync } from "node:fs";
import { join } from "node:path";

const API_SRC = join(__dirname, "../..");
const read = (rel: string) => readFileSync(join(API_SRC, rel), "utf8");

describe("P1 application timeline classification", () => {
  it("writes APPLICATION_CREATED inside createApplication with the transaction client", () => {
    const service = read("modules/applications/service.ts");
    const methodStart = service.indexOf("async createApplication(");
    const methodEnd = service.indexOf("async getApplication(");
    const method = service.slice(methodStart, methodEnd);
    expect(method).toMatch(/logApplicationActivity\(/);
    expect(method).toMatch(/APPLICATION_CREATED/);
    expect(method).toMatch(/,\s*tx\s*\)/);
    expect(read("modules/applications/controller.ts")).not.toMatch(/APPLICATION_CREATED/);
    expect(read("modules/applications/controller.ts")).not.toMatch(/logApplicationActivity/);
  });

  it("writes APPLICATION_SUBMITTED inside persistSubmittedApplication with the transaction client", () => {
    const service = read("modules/applications/service.ts");
    const persistIdx = service.indexOf("const persistSubmittedApplication");
    const persistEnd = service.indexOf("applyContractCapacityChange(contractId, prisma, persistSubmittedApplication");
    const persist = service.slice(persistIdx, persistEnd);
    expect(persist).toMatch(/logApplicationActivity\(/);
    expect(persist).toMatch(/APPLICATION_SUBMITTED/);
    expect(persist).toMatch(/,\s*tx\s*\)/);
    expect(read("modules/applications/controller.ts")).not.toMatch(/APPLICATION_SUBMITTED/);
  });

  it("does not register an application timeline repair job", () => {
    const jobs = read("lib/jobs/index.ts");
    expect(jobs).not.toMatch(/application-timeline-repair/);
    expect(jobs).not.toMatch(/runApplicationTimelineRepairJob/);
    expect(jobs).not.toMatch(/APPLICATION_TIMELINE_REPAIR/);
    expect(read("lib/jobs/with-advisory-lock.ts")).not.toMatch(/APPLICATION_TIMELINE_REPAIR/);
  });
});
