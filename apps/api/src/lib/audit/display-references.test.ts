import { snapshotBusinessReference, mergeDisplayReferences } from "./display-references";

describe("snapshotBusinessReference", () => {
  it("stores a display reference and never copies the canonical DB id", () => {
    expect(snapshotBusinessReference("APP-CS-2026-001", "cuid-app-1")).toBe("APP-CS-2026-001");
    expect(snapshotBusinessReference("cuid-app-1", "cuid-app-1")).toBeUndefined();
    expect(snapshotBusinessReference("  ", "cuid-app-1")).toBeUndefined();
  });
});

describe("mergeDisplayReferences", () => {
  it("adds class-B references without copying application_id into metadata", () => {
    const merged = mergeDisplayReferences(
      { offered_facility: 1000 },
      {
        applicationReference: "APP-CS-2026-001",
        contractReference: "FAC-ARF-202608-A1Z",
        invoiceReference: "INV-ARF-202608-B2Y",
      }
    );
    expect(merged).toMatchObject({
      offered_facility: 1000,
      applicationReference: "APP-CS-2026-001",
      contractReference: "FAC-ARF-202608-A1Z",
      invoiceReference: "INV-ARF-202608-B2Y",
    });
    expect(merged).not.toHaveProperty("application_id");
  });
});
