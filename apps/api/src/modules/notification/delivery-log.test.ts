import {
  isNotificationLogUniqueConflict,
  notificationLogTargetToPortal,
  portalToNotificationLogTarget,
  summarizeNotificationDelivery,
  systemNotificationLogKey,
} from "./delivery-log";

describe("summarizeNotificationDelivery", () => {
  it("counts selected platform and email channels from created rows only", () => {
    expect(
      summarizeNotificationDelivery([
        { send_to_platform: true, send_to_email: true },
        { send_to_platform: true, send_to_email: false },
        { send_to_platform: false, send_to_email: true },
        null,
      ])
    ).toEqual({ deliveredPlatformCount: 2, deliveredEmailCount: 2 });
  });

  it("returns zero counts when every recipient is skipped", () => {
    expect(summarizeNotificationDelivery([null, null])).toEqual({
      deliveredPlatformCount: 0,
      deliveredEmailCount: 0,
    });
  });
});

describe("portalToNotificationLogTarget", () => {
  it("maps issuer and investor portals to log target types", () => {
    expect(portalToNotificationLogTarget("issuer")).toBe("ISSUERS");
    expect(portalToNotificationLogTarget("investor")).toBe("INVESTORS");
    expect(portalToNotificationLogTarget(undefined)).toBe("ALL_USERS");
  });

  it("maps log target types back to a portal for custom-send metadata", () => {
    expect(notificationLogTargetToPortal("ISSUERS")).toBe("issuer");
    expect(notificationLogTargetToPortal("INVESTORS")).toBe("investor");
    expect(notificationLogTargetToPortal("ALL_USERS")).toBeUndefined();
    expect(notificationLogTargetToPortal("SPECIFIC_USERS")).toBeUndefined();
    expect(notificationLogTargetToPortal("GROUP")).toBeUndefined();
  });
});

describe("systemNotificationLogKey", () => {
  it("builds a stable type-prefixed SYSTEM log key", () => {
    expect(systemNotificationLogKey("note_published", "note:lifecycle:n1:published")).toBe(
      "system-log:note_published:note:lifecycle:n1:published"
    );
  });

  it("treats P2002 as an expected unique conflict", () => {
    expect(isNotificationLogUniqueConflict({ code: "P2002" })).toBe(true);
    expect(isNotificationLogUniqueConflict(new Error("db down"))).toBe(false);
  });
});
