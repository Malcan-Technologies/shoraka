import { adminHeroTintModifierClass, ADMIN_HERO_PATTERN_CLASS, ADMIN_HERO_SURFACE_CLASS, heroAsideClusterClass, heroSummaryClusterClass } from "./admin-entity-header-layout";

describe("heroAsideClusterClass", () => {
  it("locks a single KPI rail at 20rem so amount cards do not shrink-wrap to actions", () => {
    const className = heroAsideClusterClass(1);
    expect(className).toContain("xl:w-[20rem]");
    expect(className).toContain("xl:shrink-0");
    expect(className).not.toContain("min-w-0");
  });

  it("caps two KPI wells so identity keeps half the hero", () => {
    const className = heroAsideClusterClass(2);
    expect(className).toContain("xl:w-[min(28rem,48%)]");
    expect(className).not.toContain("lg:w-[41rem]");
  });

  it("caps three KPI wells instead of reserving 20rem each", () => {
    const className = heroAsideClusterClass(3);
    expect(className).toContain("xl:w-[min(36rem,52%)]");
    expect(className).toContain("min-w-0");
    expect(className).not.toContain("lg:w-[62rem]");
  });
});

describe("heroSummaryClusterClass", () => {
  it("gives a single KPI the full stacked row instead of a half-width 2-col cell", () => {
    const className = heroSummaryClusterClass(1);
    expect(className).toContain("grid-cols-1");
    expect(className).not.toContain("grid-cols-2");
  });

  it("stacks two KPIs on narrow viewports then places them side by side", () => {
    const className = heroSummaryClusterClass(2);
    expect(className).toContain("grid-cols-1");
    expect(className).toContain("sm:grid-cols-2");
    expect(className).not.toContain("lg:flex-1");
  });

  it("stacks three KPIs on narrow viewports so labels are not squeezed into 2-col leftovers", () => {
    const className = heroSummaryClusterClass(3);
    expect(className).toContain("grid-cols-1");
    expect(className).toContain("md:grid-cols-3");
    expect(className).toContain("xl:grid-cols-1");
    expect(className).toContain("2xl:grid-cols-3");
    expect(className).not.toContain("sm:grid-cols-3");
  });
});

describe("adminHeroTintModifierClass", () => {
  it("uses issuer brand red, investor portal brown, or the status token", () => {
    expect(adminHeroTintModifierClass("issuer")).toBe("admin-hero-tint-issuer");
    expect(adminHeroTintModifierClass("investor")).toBe("admin-hero-tint-investor");
    expect(adminHeroTintModifierClass("status", "action")).toBe("admin-hero-tint-action");
    expect(adminHeroTintModifierClass("status")).toBeNull();
    expect(ADMIN_HERO_SURFACE_CLASS).toBe("admin-hero-surface");
    expect(ADMIN_HERO_PATTERN_CLASS).toBe("admin-hero-pattern");
  });
});
