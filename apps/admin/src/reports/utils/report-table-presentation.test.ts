import { presentReportCell, formatReportEnumLabel } from "./report-table-presentation";

describe("report table presentation", () => {
  it("humanizes seed note references and servicing tokens", () => {
    expect(formatReportEnumLabel("LATE_TEST_DEFAULTED")).toBe("Late Test Defaulted");
    expect(formatReportEnumLabel("DEFAULTED")).toBe("Defaulted");
    expect(formatReportEnumLabel("DPD_1_30")).toBe("1–30 days");
    expect(formatReportEnumLabel("NOTE-20250515-ABCD1234")).toBe("NOTE-20250515-ABCD1234");
  });

  it("renders note, status, and bucket as badges", () => {
    const row = {
      noteId: "note-1",
      noteReference: "LATE_TEST_DEFAULTED",
      servicingStatus: "DEFAULTED",
      dpdBucket: "DPD_31_60",
      isInternalNpl: true,
    };

    expect(
      presentReportCell({ key: "noteReference", label: "Note", kind: "text" }, row)
    ).toEqual({
      kind: "badge",
      label: "Late Test Defaulted",
      token: "rejected",
      href: "/notes/note-1",
    });
    expect(
      presentReportCell({ key: "servicingStatus", label: "Servicing status", kind: "text" }, row)
    ).toEqual({
      kind: "badge",
      label: "Defaulted",
      token: "rejected",
    });
    expect(
      presentReportCell({ key: "dpdBucket", label: "Bucket", kind: "text" }, row)
    ).toEqual({
      kind: "badge",
      label: "31–60 days",
      token: "action",
    });
    expect(
      presentReportCell({ key: "isInternalNpl", label: "Internal NPL", kind: "boolean" }, row)
    ).toEqual({
      kind: "badge",
      label: "Yes",
      token: "rejected",
    });
  });

  it("renders listing, funding, and outcome as badges", () => {
    expect(
      presentReportCell(
        { key: "listingStatus", label: "Listing status", kind: "text" },
        { listingStatus: "PUBLISHED" }
      )
    ).toEqual({ kind: "badge", label: "Published", token: "active" });
    expect(
      presentReportCell(
        { key: "fundingStatus", label: "Funding status", kind: "text" },
        { fundingStatus: "FUNDED" }
      )
    ).toEqual({ kind: "badge", label: "Funded", token: "success" });
    expect(
      presentReportCell({ key: "outcome", label: "Outcome", kind: "text" }, { outcome: "Failed" })
    ).toEqual({ kind: "badge", label: "Failed", token: "rejected" });
  });
});
