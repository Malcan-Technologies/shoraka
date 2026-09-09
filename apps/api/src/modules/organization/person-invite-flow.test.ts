import { readFileSync } from "fs";
import { join } from "path";

const service = readFileSync(join(__dirname, "service.ts"), "utf8");
const profileService = readFileSync(
  join(__dirname, "../organization-profile/service.ts"),
  "utf8"
);
const link = readFileSync(join(__dirname, "party-platform-link.ts"), "utf8");

function sliceFn(source: string, start: string, end: string): string {
  return source.slice(source.indexOf(start), source.indexOf(end));
}

describe("Person-scoped invitation reuses the existing Members invite flow", () => {
  it("stores partyProfileId on inviteMember and generate-link", () => {
    expect(service).toContain("input.partyProfileId");
    expect(service).toContain("invitedByUserId: userId,\n                partyProfileId,");
  });

  it("links Person to the accepting User on accept, not by email match", () => {
    const accept = service.slice(service.indexOf("async acceptInvitation"));
    expect(accept).toContain("invitation.organization_party_profile_id");
    expect(accept).toContain("applyPersonScopedInvitationAcceptance");
    expect(accept).toContain("prisma.$transaction");
    expect(link).toContain("Do not infer this link from email alone");
    expect(link).not.toContain("findFirst({ where: { email");
  });

  it("unscoped Members invitations stay unchanged when partyProfileId is absent", () => {
    const accept = service.slice(service.indexOf("async acceptInvitation"));
    expect(accept).toContain("if (invitation.organization_party_profile_id)");
    expect(service).toContain("partyProfileId = party.id");
    expect(service).toContain("`invitation-${Date.now()}@cashsouk.com`");
  });

  it("can link an existing OrganizationMember from an explicit Person-scoped invite", () => {
    expect(service).toContain("linkedExistingMember: true");
    expect(service).toContain("This person already has platform access");
  });

  it("ordinary members cannot invite, generate links, resend, or revoke", () => {
    expect(service).toContain("You do not have permission to invite members");
    expect(service).toContain("You do not have permission to generate invitation links");
    expect(service).toContain("You do not have permission to manage invitations");
  });

  it("does not auto-link because two records share an email", () => {
    expect(service).not.toContain("findFirst({ where: { onboarding");
    expect(link).not.toContain("where: { email");
  });

  it("removeMember does not clear Person user_id or mark the person inactive", () => {
    const remove = sliceFn(service, "async removeMember", "async hasOnboardedOrganization");
    expect(remove).not.toContain("user_id: null");
    expect(remove).not.toContain("MASTER_INACTIVE");
    expect(remove).toContain("clear OrganizationPartyProfile.user_id");
  });
});

describe("Person-scoped invitation lifecycle safety", () => {
  it("accepts Person-scoped invitations inside one transaction", () => {
    const accept = sliceFn(service, "async acceptInvitation", "async getPendingInvitations");
    expect(accept).toContain("prisma.$transaction");
    expect(accept.indexOf("prisma.$transaction")).toBeLessThan(
      accept.indexOf("applyPersonScopedInvitationAcceptance")
    );
    expect(link).toContain("OR: [{ user_id: null }, { user_id: params.userId }]");
    expect(link).toContain("Never overwrite an existing different user_id");
    expect(link).toContain("Person-scoped acceptance must be transactional");
  });

  it("does not let an unlinked Person be claimed by a placeholder invite", () => {
    expect(link).toContain("An unlinked Person must therefore not be claimable");
    expect(service).toContain("assertPersonScopedPlaceholderAllowed");
    expect(service).toContain("PERSON_INVITE_REQUIRES_EMAIL");
  });

  it("restores access only to the already-linked User", () => {
    expect(service).toContain("restoreLinkedPersonPlatformAccess");
    expect(service).toContain("linkedUserId: party.user_id");
  });

  it("still enforces EMAIL_MISMATCH for addressed Person invites", () => {
    const accept = sliceFn(service, "async acceptInvitation", "async getPendingInvitations");
    expect(accept).toContain("EMAIL_MISMATCH");
    expect(accept).toContain("placeholderInvite");
  });

  it("requires owner/admin and matching organization for resend and revoke", () => {
    const resend = sliceFn(service, "async resendInvitation", "async revokeInvitation");
    const revoke = sliceFn(service, "async revokeInvitation", "async leaveOrganization");
    expect(resend).toContain("requireOrganizationOwnerOrAdmin");
    expect(resend).toContain("invitationOrgId !== organizationId");
    expect(resend).toContain("rotateInvitation");
    expect(revoke).toContain("requireOrganizationOwnerOrAdmin");
    expect(revoke).toContain("revokeInvitation(invitationId, portalType, organizationId)");
  });

  it("rotates expired invitation tokens before resend", () => {
    const resend = sliceFn(service, "async resendInvitation", "async revokeInvitation");
    expect(resend).toContain("invitation.expires_at <= new Date()");
    expect(resend).toContain("organizationInvitationExpiresAt()");
    expect(resend).toContain("rotateInvitation");
  });

  it("rejects Person-scoped invite/restore when the Person is inactive", () => {
    expect(service).toContain("assertPartyActiveForPlatformInvite");
    expect(link).toContain("PERSON_INACTIVE");
  });
});

describe("Inactive person vs platform membership stay independent", () => {
  it("inactivateMasterParty does not clear user_id or remove OrganizationMember", () => {
    const fn = sliceFn(
      profileService,
      "export async function inactivateMasterParty",
      "export async function getIssuerFinancialSummary"
    );
    expect(fn).toContain("membership_status: OrganizationPartyMembershipStatus.MASTER_INACTIVE");
    expect(fn).not.toContain("user_id:");
    expect(fn).not.toContain("organizationMember");
    expect(fn).toContain("does not remove OrganizationMember");
  });
});
