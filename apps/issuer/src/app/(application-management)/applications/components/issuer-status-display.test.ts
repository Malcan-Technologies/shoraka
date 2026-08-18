import { formatApplicationReference } from "@cashsouk/types";
import { badgeKeyToStatusToken } from "../../../../../../../packages/config/src/status-badges";

describe("issuer application display reference", () => {
  it("prefers canonical application reference", () => {
    expect(
      formatApplicationReference({
        id: "clabcdefghijklmnop",
        displayReference: "APP-ARF-202608-A82",
      })
    ).toBe("APP-ARF-202608-A82");
  });

  it("falls back to short id for historical applications", () => {
    expect(formatApplicationReference({ id: "clabcdefghijklmnop" })).toBe("#IJKLMNOP");
  });
});

describe("badgeKeyToStatusToken", () => {
  it("maps viewer-centric colours for issuer cards", () => {
    expect(badgeKeyToStatusToken("draft")).toBe("neutral");
    expect(badgeKeyToStatusToken("amendment_requested")).toBe("action");
    expect(badgeKeyToStatusToken("offer_sent")).toBe("action");
    expect(badgeKeyToStatusToken("submitted")).toBe("submitted");
    expect(badgeKeyToStatusToken("completed")).toBe("success");
    expect(badgeKeyToStatusToken("withdrawn")).toBe("neutral");
    expect(badgeKeyToStatusToken("rejected")).toBe("rejected");
  });
});
