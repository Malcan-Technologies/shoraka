import { readFileSync } from "fs";
import { join } from "path";

const service = readFileSync(join(__dirname, "service.ts"), "utf8");
const profileService = readFileSync(
  join(__dirname, "../organization-profile/service.ts"),
  "utf8"
);
const link = readFileSync(join(__dirname, "party-platform-link.ts"), "utf8");

describe("Person-scoped invitation reuses the existing Members invite flow", () => {
  it("stores partyProfileId on inviteMember and generate-link", () => {
    expect(service).toContain("input.partyProfileId");
    expect(service).toContain("invitedByUserId: userId,\n                partyProfileId,");
  });

  it("links Person to the accepting User on accept, not by email match", () => {
    const accept = service.slice(service.indexOf("async acceptInvitation"));
    expect(accept).toContain("invitation.organization_party_profile_id");
    expect(accept).toContain("linkPartyProfileToUser");
    expect(accept).toContain("userId,");
    expect(link).toContain("Do not infer this link from email alone");
    expect(link).not.toContain("findFirst({ where: { email");
  });

  it("unscoped Members invitations stay unchanged when partyProfileId is absent", () => {
    const accept = service.slice(service.indexOf("async acceptInvitation"));
    expect(accept).toContain("if (invitation.organization_party_profile_id)");
    expect(service).toContain("partyProfileId = party.id");
  });

  it("can link an existing OrganizationMember from an explicit Person-scoped invite", () => {
    expect(service).toContain("linkedExistingMember: true");
    expect(service).toContain("This person already has platform access");
  });

  it("ordinary members cannot invite or generate links", () => {
    expect(service).toContain("You do not have permission to invite members");
    expect(service).toContain("You do not have permission to generate invitation links");
  });

  it("does not auto-link because two records share an email", () => {
    expect(service).not.toContain("findFirst({ where: { onboarding");
    expect(link).not.toContain("where: { email");
  });

  it("removeMember does not clear Person user_id or mark the person inactive", () => {
    const remove = service.slice(
      service.indexOf("async removeMember"),
      service.indexOf("async hasOnboardedOrganization")
    );
    expect(remove).not.toContain("user_id: null");
    expect(remove).not.toContain("MASTER_INACTIVE");
    expect(remove).toContain("clear OrganizationPartyProfile.user_id");
  });
});

describe("Inactive person vs platform membership stay independent", () => {
  it("inactivateMasterParty does not clear user_id or remove OrganizationMember", () => {
    const fn = profileService.slice(
      profileService.indexOf("export async function inactivateMasterParty"),
      profileService.indexOf("export async function getIssuerFinancialSummary")
    );
    expect(fn).toContain("membership_status: OrganizationPartyMembershipStatus.MASTER_INACTIVE");
    expect(fn).not.toContain("user_id:");
    expect(fn).not.toContain("organizationMember");
    expect(fn).toContain("does not remove OrganizationMember");
  });
});
