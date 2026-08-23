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

  it("enables Copy Link, Resend, and Revoke only when canManageRoles is true", () => {
    const copyStart = tableSource.indexOf("onClick={handleCopyLink}");
    const nextButton = tableSource.indexOf("<Button", copyStart + 1);
    const copyBlock = tableSource.slice(copyStart, nextButton);
    expect(copyBlock).toContain("disabled={!canManageRoles || isCopying || copiedId === invitation.id}");
    expect(copyBlock).toContain("Copy Link");
    expect(copyBlock).toContain('title={!canManageRoles ? "You do not have permission to perform this action." : undefined}');
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

  it("copies via the audited onCopyLink action instead of a local token URL", () => {
    expect(tableSource).toContain("const { inviteUrl } = await onCopyLink(invitation.id)");
    expect(tableSource).not.toContain("NEXT_PUBLIC_ADMIN_URL");
    expect(tableSource).not.toContain("getInviteUrl");
    expect(tableSource).not.toContain("/callback?invitation=");
    expect(rolesPageSource).toContain("useCopyInvitationLink");
    expect(rolesPageSource).toContain("onCopyLink={(id) => copyInvitationLink.mutateAsync(id)}");
  });

  it("keeps the roles page as the source of roles.manage", () => {
    expect(rolesPageSource).toContain('const canManageRoles = can("roles.manage")');
    expect(rolesPageSource).toMatch(
      /<PendingInvitationsTable[\s\S]*canManageRoles=\{canManageRoles\}/
    );
  });
});
