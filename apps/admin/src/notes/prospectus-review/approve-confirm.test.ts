import {
  getProspectusApproveConfirmCopy,
  prospectusApprovePrimaryLabel,
  PROSPECTUS_APPROVE_CONFIRM,
} from "./approve-confirm";

describe("prospectus approve confirm copy", () => {
  it("uses dirty Save & Approve wording when the form is dirty", () => {
    const copy = getProspectusApproveConfirmCopy(true);
    expect(copy.title).toBe("Save changes and approve Prospectus?");
    expect(copy.description).toBe(
      "You have unsaved changes. Approving will save the current form values and approve this version of the Prospectus."
    );
    expect(copy.confirmLabel).toBe("Save & Approve");
  });

  it("uses clean Approve wording when the form is clean", () => {
    const copy = getProspectusApproveConfirmCopy(false);
    expect(copy.title).toBe("Approve Prospectus?");
    expect(copy.description).toBe(
      "This will freeze the current saved Prospectus content for publication."
    );
    expect(copy.confirmLabel).toBe("Approve");
  });

  it("shows Saving… then Approving… labels during dirty Save & Approve", () => {
    expect(prospectusApprovePrimaryLabel(true, "idle")).toBe("Save & Approve");
    expect(prospectusApprovePrimaryLabel(true, "saving")).toBe("Saving…");
    expect(prospectusApprovePrimaryLabel(true, "approving")).toBe("Approving…");
    expect(prospectusApprovePrimaryLabel(false, "approving")).toBe("Approving…");
    expect(prospectusApprovePrimaryLabel(false, "idle")).toBe("Approve");
  });

  it("keeps dirty and clean copy objects distinct", () => {
    expect(PROSPECTUS_APPROVE_CONFIRM.dirty.confirmLabel).not.toBe(
      PROSPECTUS_APPROVE_CONFIRM.clean.confirmLabel
    );
  });
});
