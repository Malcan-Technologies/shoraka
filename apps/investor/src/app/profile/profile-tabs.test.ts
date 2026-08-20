import {
  isProfileTab,
  PROFILE_BANKING_HREF,
  profileTabFromSearchParam,
} from "./profile-tabs";

describe("profile tabs", () => {
  it("opens banking from the query string", () => {
    expect(profileTabFromSearchParam("banking")).toBe("banking");
    expect(profileTabFromSearchParam("documents")).toBe("documents");
    expect(profileTabFromSearchParam(null)).toBe("profile");
    expect(isProfileTab("settings")).toBe(false);
    expect(PROFILE_BANKING_HREF).toBe("/profile?tab=banking");
  });
});
