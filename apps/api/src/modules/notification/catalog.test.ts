import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { NotificationTypeIds } from "./registry";
import { initialNotificationTypes } from "./seed-data";

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkTsFiles(full, out);
    else if (/\.tsx?$/.test(full) && !/\.(test|spec)\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

describe("notification catalog", () => {
  it("keeps seed rows aligned with the typed registry", () => {
    const seedIds = initialNotificationTypes.map((type) => type.id).sort();
    const registryIds = Object.values(NotificationTypeIds).sort();
    expect(seedIds).toEqual(registryIds);
  });

  it("defaults investment_committed and deposit_successful to platform on, email off, Admin-configurable", () => {
    for (const id of [
      NotificationTypeIds.INVESTMENT_COMMITTED,
      NotificationTypeIds.DEPOSIT_SUCCESSFUL,
    ]) {
      const row = initialNotificationTypes.find((type) => type.id === id);
      expect(row).toMatchObject({
        enabled_platform: true,
        enabled_email: false,
        user_configurable: true,
      });
    }
  });

  it("does not use sendTypedPlatformOnly in production source", () => {
    const apiSrc = join(__dirname, "../..");
    const hits = walkTsFiles(apiSrc).filter((file) =>
      readFileSync(file, "utf8").includes("sendTypedPlatformOnly")
    );
    expect(hits).toEqual([]);
  });

  it("wires investment_committed and deposit_successful to live commit and credit callers", () => {
    const notesService = readFileSync(join(__dirname, "../notes/service.ts"), "utf8");
    expect(notesService).toContain("notifyInvestmentCommitted");
    const webhook = readFileSync(join(__dirname, "../payment/webhook-service.ts"), "utf8");
    expect(webhook).toContain("notifyDepositSuccessful");
    const admin = readFileSync(join(__dirname, "../payment/admin-service.ts"), "utf8");
    expect(admin).toContain("notifyDepositSuccessful");
  });
});
