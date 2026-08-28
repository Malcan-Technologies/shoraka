import {
  buildAdminActivityCsv,
  mergeActivityCsvMetadata,
  type AdminActivityCsvRow,
} from "./admin-activity-csv";

describe("buildAdminActivityCsv", () => {
  it("maps forensic source API to Portal without changing portal or actor", () => {
    const csv = buildAdminActivityCsv([
      {
        createdAt: "2026-08-25T10:15:00.000Z",
        event: "Application Submitted",
        eventType: "APPLICATION_SUBMITTED",
        actor: "Jane Admin",
        actorUserId: "user-1",
        actorType: "ADMIN",
        portal: "ADMIN",
        remark: "",
        metadata: null,
        source: "API",
      },
    ]);
    expect(csv).toContain("Portal");
    expect(csv).toContain("Jane Admin");
    expect(csv).toContain("ADMIN");
    expect(csv).not.toContain('"API"');
  });

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
      '"Timestamp","Event","Event Type","Actor","Actor Type","Actor Email","Organisation","Source","Target Type","Target Reference","Status","Amount","Reason","Correlation ID","Metadata"'
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
