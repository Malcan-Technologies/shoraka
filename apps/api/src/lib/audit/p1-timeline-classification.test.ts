import { readFileSync } from "node:fs";
import { join } from "node:path";

const API_SRC = join(__dirname, "../..");
const read = (rel: string) => readFileSync(join(API_SRC, rel), "utf8");

describe("P1 application timeline classification", () => {
  it("keeps APPLICATION_CREATED as a sequential overlay after createApplication commits", () => {
    const controller = read("modules/applications/controller.ts");
    const createIdx = controller.indexOf("const application = await applicationService.createApplication");
    const window = controller.slice(createIdx, createIdx + 700);
    expect(window).toMatch(/logApplicationActivity\(/);
    expect(window).toMatch(/APPLICATION_CREATED/);
    expect(window).not.toMatch(/\$transaction/);

    const service = read("modules/applications/service.ts");
    const methodStart = service.indexOf("async createApplication(");
    const methodEnd = service.indexOf("async getApplication(");
    expect(service.slice(methodStart, methodEnd)).not.toMatch(/logApplicationActivity/);
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
});
