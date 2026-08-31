import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
}

describe("admin vertical timeline", () => {
  const shared = read("admin-vertical-timeline.tsx");

  it("uses brand type tokens and a title-plus-time header", () => {
    expect(shared).toContain("text-ui font-medium leading-snug");
    expect(shared).toContain("text-ui text-muted-foreground");
    expect(shared).toContain("text-meta text-muted-foreground");
    expect(shared).toContain("formatAuditDateTime");
    expect(shared).not.toContain("formatDistanceToNow");
    expect(shared).not.toContain("text-[10px]");
    expect(shared).not.toContain("text-[11px]");
  });

  it("uses an originator avatar on the rail and hides opaque actor ids", () => {
    expect(shared).toContain("AdminTimelineOriginatorMark");
    expect(shared).toContain("ComputerDesktopIcon");
    expect(shared).toContain("displayAdminTimelineActorName");
    expect(shared).toContain("AdminTimelineDetailCard");
    expect(shared).not.toContain("dotClassName");
    expect(shared).not.toContain("bg-primary/10");
    expect(shared).not.toContain("ipAddress");
    expect(shared).not.toContain("highlighted");
  });
});

describe("admin timeline wrappers use the shared list", () => {
  const files = [
    "admin-activity-timeline.tsx",
    "organization-activity-timeline.tsx",
    "../notes/components/note-timeline-panel.tsx",
    "../contracts/components/contract-activity-panel.tsx",
    "../paymasters/components/paymaster-activity-panel.tsx",
    "../app/finance/gateway-payments/[id]/page.tsx",
  ];

  it.each(files)("%s imports AdminVerticalTimeline", (relativePath) => {
    const source = read(relativePath);
    expect(source).toContain("AdminVerticalTimeline");
    expect(source).toContain("AdminDetailCardHeader");
    expect(source).toContain("AdminActivityCsvExportButton");
  });
});
