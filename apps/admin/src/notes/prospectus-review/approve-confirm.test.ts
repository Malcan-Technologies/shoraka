import {
  getProspectusApproveConfirmCopy,
  prospectusApprovePrimaryLabel,
  PROSPECTUS_APPROVE_CONFIRM,
} from "./approve-confirm";

describe("prospectus approve confirm copy", () => {
  it("uses dirty Save & Approve wording when the form is dirty", () => {
    const copy = getProspectusApproveConfirmCopy(true);
    expect(copy.title).toBe("Save changes and mark Ready for Publish?");
    expect(copy.description).toBe(
      "You have unsaved changes. Marking Ready will save the current form values and lock this version of the Prospectus content."
    );
    expect(copy.confirmLabel).toBe("Save & Mark Ready");
  });

  it("uses clean Approve wording when the form is clean", () => {
    const copy = getProspectusApproveConfirmCopy(false);
    expect(copy.title).toBe("Mark Prospectus Ready for Publish?");
    expect(copy.description).toBe(
      "This will lock the current saved Prospectus content. The final PDF will be generated when you publish the Note."
    );
    expect(copy.confirmLabel).toBe("Mark Ready");
  });

  it("shows Saving… then Approving… labels during dirty Save & Approve", () => {
    expect(prospectusApprovePrimaryLabel(true, "idle")).toBe("Save & Mark Ready");
    expect(prospectusApprovePrimaryLabel(true, "saving")).toBe("Saving…");
    expect(prospectusApprovePrimaryLabel(true, "approving")).toBe("Approving…");
    expect(prospectusApprovePrimaryLabel(false, "approving")).toBe("Approving…");
    expect(prospectusApprovePrimaryLabel(false, "idle")).toBe("Mark Ready");
  });

  it("keeps dirty and clean copy objects distinct", () => {
    expect(PROSPECTUS_APPROVE_CONFIRM.dirty.confirmLabel).not.toBe(
      PROSPECTUS_APPROVE_CONFIRM.clean.confirmLabel
    );
  });
});
