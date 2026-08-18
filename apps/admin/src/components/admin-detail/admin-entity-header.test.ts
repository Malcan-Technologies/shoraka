import { heroSummaryClusterClass } from "./admin-entity-header-layout";

describe("heroSummaryClusterClass", () => {
  it("gives a single KPI the full stacked row instead of a half-width 2-col cell", () => {
    const className = heroSummaryClusterClass(1);
    expect(className).toContain("grid-cols-1");
    expect(className).not.toContain("grid-cols-2");
    expect(className).toContain("lg:w-[20rem]");
    expect(className).toContain("lg:grow-0");
  });

  it("keeps two KPIs side by side and caps the cluster so identity keeps leftover space", () => {
    const className = heroSummaryClusterClass(2);
    expect(className).toContain("grid-cols-2");
    expect(className).toContain("lg:w-[41rem]");
    expect(className).toContain("lg:grow-0");
    expect(className).not.toContain("lg:flex-1");
  });

  it("stacks three KPIs on narrow viewports so labels are not squeezed into 2-col leftovers", () => {
    const className = heroSummaryClusterClass(3);
    expect(className).toContain("grid-cols-1");
    expect(className).toContain("sm:grid-cols-3");
    expect(className).toContain("lg:w-[62rem]");
  });
});
