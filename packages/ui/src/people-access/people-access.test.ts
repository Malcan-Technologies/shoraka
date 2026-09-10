import { readFileSync } from "fs";
import { join } from "path";

const section = readFileSync(join(__dirname, "people-access-section.tsx"), "utf8");
const invite = readFileSync(join(__dirname, "invite-user-dialog.tsx"), "utf8");
const detail = readFileSync(join(__dirname, "person-detail-view.tsx"), "utf8");

describe("People & Access customer UI", () => {
  it("uses one table with Company Role, Platform Access, KYC and AML", () => {
    expect(section).toContain(">Company Role<");
    expect(section).toContain(">Platform Access<");
    expect(section).toContain(">KYC<");
    expect(section).toContain(">AML<");
    expect(section).not.toContain(">Status<");
    expect(section).toContain("Add company person");
    expect(section).toContain("Invite user");
    expect(section).toContain("Inactive company people");
  });

  it("does not merge rows by email", () => {
    expect(section).toContain("buildPeopleAccessRows");
    expect(section).not.toContain("find((row) => row.email");
    expect(invite).toContain("does not link records by email");
  });

  it("keeps Person Email and Account Email distinct", () => {
    expect(invite).toContain("Prefills Person Email for delivery");
    expect(detail).toContain('label="Person Email"');
    expect(detail).toContain('label="Account Email"');
    expect(detail).toContain("isPersonEmailLifecycleLocked");
    expect(detail).toContain("/ctos-party-email");
  });

  it("does not create a second KYC request while IN_PROGRESS", () => {
    expect(detail).toContain("!inProgressKyc");
    expect(detail).toContain("An onboarding request is already in progress");
    expect(section).toContain('!== "IN_PROGRESS"');
  });

  it("treats Owner as platform ownership and User as ORGANIZATION_MEMBER", () => {
    expect(invite).toContain(">User<");
    expect(invite).toContain(">Admin<");
    expect(invite).not.toContain("ORGANIZATION_OWNER");
    expect(section).toContain("Transfer CashSouk organisation ownership");
    expect(detail).toContain("Transfer CashSouk organisation ownership");
  });
});
