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
    expect(service).toContain("issuePersonScopedInvitation");
    expect(service).toContain("partyProfileId: params.partyProfileId");
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
    expect(accept).toContain("invitationEmailsMatch(user.email, invitation.email)");
    expect(accept).not.toContain("user.email !== invitation.email");
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

const repository = readFileSync(join(__dirname, "repository.ts"), "utf8");
const schema = readFileSync(join(__dirname, "../../../prisma/schema.prisma"), "utf8");
const generateLink = sliceFn(
  service,
  "async generateMemberInvitationUrl",
  "async acceptInvitation"
);
const issuePerson = sliceFn(
  service,
  "private async issuePersonScopedInvitation",
  "async createOrganization"
);

describe("Person-scoped invitation reuse and supersession", () => {
  it("reuses an active Person-scoped invite only when org, party, role, and normalized email match", () => {
    expect(link).toContain("Person-scoped invitations must not be reused across different addressed");
    expect(link).toContain("findReusablePersonScopedInvitation");
    expect(link).toContain("invitationEmailsMatch(row.email, email) && row.role === role");
    expect(generateLink).toContain("issuePersonScopedInvitation");
    expect(issuePerson).toContain("runPersonScopedInvitationIssue");
    expect(issuePerson).toContain("listActivePersonScopedInvitations");
    expect(issuePerson).toContain("lockOrganizationPartyProfileForUpdate");
  });

  it("serializes Person-scoped invite creation under a party row lock in one transaction", () => {
    expect(issuePerson.indexOf("prisma.$transaction")).toBeLessThan(
      issuePerson.indexOf("runPersonScopedInvitationIssue")
    );
    expect(issuePerson.indexOf("lockOrganizationPartyProfileForUpdate")).toBeLessThan(
      issuePerson.indexOf("listActivePersonScopedInvitations")
    );
    expect(repository).toContain("FOR UPDATE");
    expect(repository).toContain("async lockOrganizationPartyProfileForUpdate");
    expect(link).toContain("Person-scoped invitation creation is serialized per organization party.");
    expect(link).toContain("This must remain database-backed because the API may run on multiple");
  });

  it("supersedes other active Person-scoped invites so an old token cannot be accepted", () => {
    expect(issuePerson).toContain("supersedeActivePersonScopedInvitations");
    expect(issuePerson).toContain("exceptId, db: tx");
    expect(link).toContain("params.supersede(reusable.id)");
    expect(repository).toContain("async supersedeActivePersonScopedInvitations");
    expect(repository).toContain("deleteMany");
    expect(repository).toContain("accepted: false");
    expect(repository).toContain("expires_at: { gt: new Date() }");
    expect(repository).toContain("organization_party_profile_id: partyProfileId");
  });

  it("keeps generic Members generate-link reuse on email + role without Person supersede", () => {
    expect(generateLink).toContain("if (partyProfileId)");
    expect(generateLink.indexOf("issuePersonScopedInvitation")).toBeLessThan(
      generateLink.indexOf("existingInvitation")
    );
    expect(generateLink).toContain("email,\n              role: generateRole");
    expect(generateLink).not.toContain("organization_party_profile_id: partyProfileId");
  });
});

describe("Invitation email normalization", () => {
  it("normalizes invitation creation, reuse, acceptance, and existing-user lookup", () => {
    expect(service).toContain("normalizeInvitationEmail");
    expect(service).toContain("invitationEmailsMatch");
    expect(link).toContain("normalizeDirectorShareholderPartyEmail");
    expect(repository).toContain("normalizeDirectorShareholderPartyEmail");
    expect(repository).toContain('mode: "insensitive"');
    expect(service).not.toContain("input.email?.toLowerCase()");
    expect(service).not.toContain("input.email?.toLowerCase() || undefined");
  });
});

describe("Person ↔ User uniqueness comments", () => {
  it("keeps per-organization SQL partial unique indexes and rejects reassignment", () => {
    expect(schema).toContain("Same User may be linked in different organizations.");
    expect(schema).toContain("Uniqueness is only within one organization.");
    expect(schema).toContain("Prisma 5 cannot represent these partial unique indexes.");
    expect(schema).toContain("organization_party_profiles_issuer_org_user_id_key");
    expect(schema).toContain("organization_party_profiles_investor_org_user_id_key");
    expect(schema).toContain("user_id                     String?                           @db.VarChar(5)");
    expect(schema).not.toContain("@@unique([user_id])");
    expect(schema).not.toContain("@@unique([issuer_organization_id, user_id])");
    expect(link).toContain("Person ↔ User reassignment is intentionally unsupported.");
    expect(link).toContain("Do not overwrite an existing different user_id without an explicit");
  });
});
