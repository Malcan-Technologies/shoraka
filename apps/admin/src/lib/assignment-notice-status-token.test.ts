import { assignmentNoticeStatusLabel, assignmentNoticeStatusToken } from "./admin-status-token";

describe("assignment notice status tokens", () => {
  it("maps admin action, waiting, completed, and failed without reusing global GENERATED=green", () => {
    expect(assignmentNoticeStatusToken("GENERATED")).toBe("action");
    expect(assignmentNoticeStatusToken("ACKNOWLEDGEMENT_UPLOADED")).toBe("action");
    expect(assignmentNoticeStatusToken("SENT")).toBe("submitted");
    expect(assignmentNoticeStatusToken("ACKNOWLEDGED")).toBe("success");
    expect(assignmentNoticeStatusToken("FAILED")).toBe("rejected");
    expect(assignmentNoticeStatusLabel("GENERATED")).toBe("Generated");
  });
});
