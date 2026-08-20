import {
  buildAdminActivityCsv,
  mergeActivityCsvMetadata,
  type AdminActivityCsvRow,
} from "./admin-activity-csv";

describe("buildAdminActivityCsv", () => {
  it("writes a stable header and quoted cells", () => {
    const rows: AdminActivityCsvRow[] = [
      {
        createdAt: "2026-05-12T14:15:42.000Z",
        event: "Overdue late charge checked",
        eventType: "OVERDUE_LATE_CHARGE_CHECKED",
        actor: "Ada Admin",
        actorUserId: "user-1",
        portal: "ADMIN",
        remark: 'Said "not overdue"',
        metadata: { overdue: false },
      },
    ];
    const lines = buildAdminActivityCsv(rows).split("\n");
    expect(lines[0]).toBe(
      '"createdAt","event","eventType","actor","actorUserId","portal","remark","metadata"'
    );
    expect(lines[1]).toContain("Overdue late charge checked");
    expect(lines[1]).toContain('""not overdue""');
    expect(lines[1]).toContain("false");
  });

  it("exports an empty table with only the header", () => {
    expect(buildAdminActivityCsv([]).split("\n")).toHaveLength(1);
  });
});

describe("mergeActivityCsvMetadata", () => {
  it("drops empty extras and returns null when nothing remains", () => {
    expect(mergeActivityCsvMetadata(null, { actorRole: "", portal: null })).toBeNull();
    expect(mergeActivityCsvMetadata({ listingId: "lst-1" }, { actorRole: "ADMIN" })).toEqual({
      listingId: "lst-1",
      actorRole: "ADMIN",
    });
  });
});
