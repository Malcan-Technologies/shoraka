import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("admin platform sidebar navigation", () => {
  const source = readFileSync(
    join(__dirname, "../components/app-sidebar.tsx"),
    "utf8"
  );

  it("shows User Accounts linking to /accounts", () => {
    expect(source).toMatch(/title:\s*"User Accounts"[\s\S]*?url:\s*"\/accounts"/);
  });

  it("shows Issuers linking to /issuers", () => {
    expect(source).toMatch(/title:\s*"Issuers"[\s\S]*?url:\s*"\/issuers"/);
  });

  it("shows Investors linking to /investors", () => {
    expect(source).toMatch(/title:\s*"Investors"[\s\S]*?url:\s*"\/investors"/);
  });

  it("shows Legal Documents linking to /legal-documents", () => {
    expect(source).toMatch(/title:\s*"Legal Documents"[\s\S]*?url:\s*"\/legal-documents"/);
  });

  it("does not keep a standalone Legal Acceptances directory entry", () => {
    expect(source).not.toMatch(/title:\s*"Legal Acceptances"/);
    expect(source).not.toMatch(/url:\s*"\/legal-document-acceptances"/);
  });

  it("gates User Accounts with users.view", () => {
    expect(source).toContain('item.access === "users" && canViewUsers');
  });

  it("gates Issuers and Investors with organizations.view", () => {
    expect(source).toContain('item.access === "organizations" && canViewOrganizations');
  });

  it("gates legal directory items with document_management.view", () => {
    expect(source).toContain('item.access === "documents" && canViewDocuments');
  });

  it("does not keep a Notifications Logs tab in Settings", () => {
    const notifications = readFileSync(
      join(__dirname, "../app/settings/notifications/page.tsx"),
      "utf8"
    );
    expect(notifications).not.toContain('value="logs"');
    expect(notifications).not.toContain("Notification Logs");
  });

  it("shows Audit when the admin can view documents or notification logs", () => {
    expect(source).toContain("canViewDocuments ||");
    expect(source).toContain("canViewNotifications");
  });

  it("hides the obsolete placeholder Documents nav entry", () => {
    expect(source).not.toMatch(/title:\s*"Documents"/);
  });

  it("does not keep the old Users or Organizations directory URLs", () => {
    expect(source).not.toMatch(/url:\s*"\/users"/);
    expect(source).not.toMatch(/url:\s*"\/organizations"/);
  });
});
