import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("PendingInvitationsTable permission wiring", () => {
  const tableSource = readFileSync(join(__dirname, "pending-invitations-table.tsx"), "utf8");
  const rolesPageSource = readFileSync(
    join(__dirname, "../app/settings/roles/page.tsx"),
    "utf8"
  );

  it("forwards canManageRoles from the table into InvitationRow", () => {
    expect(tableSource).toMatch(
      /export function PendingInvitationsTable\(\{[\s\S]*canManageRoles = false,[\s\S]*\}: PendingInvitationsTableProps\)/
    );
    expect(tableSource).toMatch(/<InvitationRow[\s\S]*canManageRoles=\{canManageRoles\}/);
  });

  it("enables Resend and Revoke only when canManageRoles is true", () => {
    expect(tableSource).toMatch(
      /onClick=\{\(\) => onResend\(invitation\.id\)\}[\s\S]*?disabled=\{!canManageRoles\}[\s\S]*?Resend Email/
    );
    expect(tableSource).toMatch(
      /onClick=\{\(\) => onRevoke\(invitation\.id\)\}[\s\S]*?disabled=\{!canManageRoles\}[\s\S]*?Revoke/
    );
  });

  it("hides Resend for invitation- placeholder emails and still permission-gates Revoke", () => {
    expect(tableSource).toMatch(
      /\{!invitation\.email\.startsWith\("invitation-"\) && \(/
    );
    expect(tableSource).toMatch(/Resend Email/);
    expect(tableSource).toMatch(
      /onClick=\{\(\) => onRevoke\(invitation\.id\)\}[\s\S]*?disabled=\{!canManageRoles\}/
    );
  });

  it("does not permission-gate Copy Link", () => {
    const copyStart = tableSource.indexOf("onClick={handleCopyLink}");
    const nextButton = tableSource.indexOf("<Button", copyStart + 1);
    const copyBlock = tableSource.slice(copyStart, nextButton);
    expect(copyBlock).toContain("disabled={copiedId === invitation.id}");
    expect(copyBlock).toContain("Copy Link");
    expect(copyBlock).not.toContain("disabled={!canManageRoles}");
  });

  it("keeps the roles page as the source of roles.manage", () => {
    expect(rolesPageSource).toContain('const canManageRoles = can("roles.manage")');
    expect(rolesPageSource).toMatch(
      /<PendingInvitationsTable[\s\S]*canManageRoles=\{canManageRoles\}/
    );
  });
});
