import { diffWorkflow, mergeUpdatedDiff, diffProductScalars } from "./diff";

describe("product audit workflow diff", () => {
  it("returns null when workflows are equal", () => {
    const workflow = [{ id: "a", name: "A", config: { name: "N" } }];
    expect(diffWorkflow(workflow, JSON.parse(JSON.stringify(workflow)))).toBeNull();
  });

  it("records added and removed steps without full snapshots", () => {
    const before = [{ id: "a", name: "A", config: { name: "N" } }];
    const after = [
      { id: "a", name: "A", config: { name: "N" } },
      { id: "b", name: "B", config: { name: "M" } },
    ];
    const diff = diffWorkflow(before, after);
    expect(diff?.added).toEqual([{ id: "b", name: "B" }]);
    expect(diff?.removed).toBeUndefined();
  });

  it("stores only changed config keys and compacts s3_key objects", () => {
    const before = [
      {
        id: "financing_type_1",
        name: "Financing type",
        config: {
          name: "Old",
          image: { s3_key: "products/old.png", width: 1200, height: 800, blob: "x".repeat(50) },
        },
      },
    ];
    const after = [
      {
        id: "financing_type_1",
        name: "Financing type",
        config: {
          name: "New",
          image: { s3_key: "products/new.png", width: 1200, height: 800, blob: "y".repeat(50) },
        },
      },
    ];
    const diff = diffWorkflow(before, after);
    expect(diff?.changed?.[0].changedConfigKeys).toEqual(expect.arrayContaining(["name", "image"]));
    expect(diff?.changed?.[0].before.image).toEqual({ s3_key: "products/old.png" });
    expect(diff?.changed?.[0].after.image).toEqual({ s3_key: "products/new.png" });
    expect(JSON.stringify(diff)).not.toContain("width");
  });

  it("merges scalar and workflow diffs into before/after", () => {
    const merged = mergeUpdatedDiff(
      diffProductScalars(
        {
          productCode: "ARF",
          marketplaceListingDurationDays: 14,
          serviceFeeRatePercent: 15,
          defaultFacilityFeeRatePercent: 1,
          categoryDisplayOrder: 1,
          productDisplayOrder: 1,
        },
        {
          productCode: "ARF",
          marketplaceListingDurationDays: 21,
          serviceFeeRatePercent: 15,
          defaultFacilityFeeRatePercent: 1,
          categoryDisplayOrder: 1,
          productDisplayOrder: 1,
        }
      ),
      diffWorkflow(
        [{ id: "a", name: "A", config: { name: "Old" } }],
        [{ id: "a", name: "A", config: { name: "New" } }]
      )
    );
    expect(merged?.changedFields).toEqual(["marketplaceListingDurationDays", "workflow"]);
    expect(merged?.before.marketplaceListingDurationDays).toBe(14);
    expect(merged?.after.marketplaceListingDurationDays).toBe(21);
    expect((merged?.before.workflow as { changed: unknown[] }).changed).toHaveLength(1);
  });
});
