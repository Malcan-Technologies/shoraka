import { displayAdminTimelineActorName, resolveAdminTimelineActorLabel, resolveAdminTimelineOriginator } from "./admin-timeline-originator";

describe("resolveAdminTimelineOriginator", () => {
  it("uses a grey system originator for System or missing actors", () => {
    expect(resolveAdminTimelineOriginator({ actorLabel: "System", portal: "ADMIN" })).toBe(
      "system"
    );
    expect(resolveAdminTimelineOriginator({ actorLabel: "SYS", portal: "ADMIN" })).toBe("system");
    expect(resolveAdminTimelineOriginator({ actorLabel: null, portal: "ISSUER" })).toBe("system");
    expect(resolveAdminTimelineOriginator({})).toBe("system");
  });

  it("maps portal to admin, issuer, and investor", () => {
    expect(resolveAdminTimelineOriginator({ actorLabel: "Ada", portal: "ADMIN" })).toBe("admin");
    expect(resolveAdminTimelineOriginator({ actorLabel: "Ada", portal: "issuer" })).toBe("issuer");
    expect(resolveAdminTimelineOriginator({ actorLabel: "Ada", portal: "INVESTOR" })).toBe(
      "investor"
    );
  });

  it("defaults named people without a portal to admin", () => {
    expect(resolveAdminTimelineOriginator({ actorLabel: "Ada Admin" })).toBe("admin");
  });
});

describe("displayAdminTimelineActorName", () => {
  it("hides System, blank, and opaque ids", () => {
    expect(displayAdminTimelineActorName("System")).toBeNull();
    expect(displayAdminTimelineActorName("SYS")).toBeNull();
    expect(displayAdminTimelineActorName("")).toBeNull();
    expect(displayAdminTimelineActorName("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")).toBeNull();
    expect(displayAdminTimelineActorName("clabcdefghijklmnopqrstuvwx")).toBeNull();
  });

  it("keeps real names", () => {
    expect(displayAdminTimelineActorName("Ada Admin")).toBe("Ada Admin");
    expect(displayAdminTimelineActorName("Acme Capital")).toBe("Acme Capital");
  });
});

describe("resolveAdminTimelineActorLabel", () => {
  it("prefers a resolved name over a user id", () => {
    expect(
      resolveAdminTimelineActorLabel({
        actorName: "Ada Admin",
        actorUserId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        portal: "ADMIN",
      })
    ).toBe("Ada Admin");
  });

  it("uses System when there is no actor", () => {
    expect(resolveAdminTimelineActorLabel({ actorName: null, actorUserId: null })).toBe("System");
  });

  it("never surfaces an opaque id", () => {
    expect(
      resolveAdminTimelineActorLabel({
        actorName: null,
        actorUserId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        portal: "ISSUER",
      })
    ).toBe("Issuer");
  });
});
