import { getProspectusActionVisibility } from "./action-visibility";

describe("getProspectusActionVisibility status gates", () => {
  it("DRAFT complete path may show Approve Prospectus", () => {
    const actions = getProspectusActionVisibility({
      step: 3,
      status: "DRAFT",
      canManage: true,
      notePublished: false,
    });
    expect(actions.approve).toBe(true);
  });

  it("APPROVED never shows Approve Prospectus", () => {
    const actions = getProspectusActionVisibility({
      step: 3,
      status: "APPROVED",
      canManage: true,
      notePublished: false,
    });
    expect(actions.approve).toBe(false);
    expect(actions.preview).toBe(true);
    expect(actions.backToNote).toBe(true);
  });

  it("PUBLISHED never shows Approve Prospectus", () => {
    const actions = getProspectusActionVisibility({
      step: 3,
      status: "PUBLISHED",
      canManage: true,
      notePublished: true,
    });
    expect(actions.approve).toBe(false);
    expect(actions.saveDraft).toBe(false);
    expect(actions.viewProspectus).toBe(true);
    expect(actions.backToNote).toBe(true);
  });
});
