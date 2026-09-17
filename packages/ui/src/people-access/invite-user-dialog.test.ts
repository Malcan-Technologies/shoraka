import { inviteDeliveryEmail, type InviteUserPersonOption } from "./invite-user-dialog";

function person(overrides: Partial<InviteUserPersonOption>): InviteUserPersonOption {
  return {
    partyId: "p1",
    name: "Ali",
    personEmail: "person@acme.test",
    restoreExistingLink: false,
    linkedLoginEmail: "",
    ...overrides,
  };
}

describe("inviteDeliveryEmail", () => {
  it("uses Person Email as the proposed login for an unlinked person", () => {
    expect(inviteDeliveryEmail(person({}))).toBe("person@acme.test");
    expect(
      inviteDeliveryEmail(
        person({ linkedLoginEmail: "login@acme.test", restoreExistingLink: false })
      )
    ).toBe("person@acme.test");
  });

  it("uses the existing Account Email when restoring a linked person", () => {
    expect(
      inviteDeliveryEmail(
        person({
          restoreExistingLink: true,
          linkedLoginEmail: "login@acme.test",
          personEmail: "person@acme.test",
        })
      )
    ).toBe("login@acme.test");
  });
});
