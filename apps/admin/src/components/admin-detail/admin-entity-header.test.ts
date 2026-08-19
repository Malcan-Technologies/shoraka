import { adminHeroTintModifierClass, ADMIN_HERO_PATTERN_CLASS, ADMIN_HERO_SURFACE_CLASS, heroAsideClusterClass, heroSummaryClusterClass } from "./admin-entity-header-layout";

describe("heroAsideClusterClass", () => {
  it("locks a single KPI rail at 20rem so amount cards do not shrink-wrap to actions", () => {
    const className = heroAsideClusterClass(1);
    expect(className).toContain("lg:min-w-[20rem]");
    expect(className).toContain("shrink-0");
    expect(className).not.toContain("min-w-0");
  });

  it("widens the rail for two KPI wells", () => {
    expect(heroAsideClusterClass(2)).toContain("lg:w-[41rem]");
  });
});

describe("heroSummaryClusterClass", () => {
  it("gives a single KPI the full stacked row instead of a half-width 2-col cell", () => {
    const className = heroSummaryClusterClass(1);
    expect(className).toContain("grid-cols-1");
    expect(className).not.toContain("grid-cols-2");
  });

  it("keeps two KPIs side by side", () => {
    const className = heroSummaryClusterClass(2);
    expect(className).toContain("grid-cols-2");
    expect(className).not.toContain("lg:flex-1");
  });

  it("stacks three KPIs on narrow viewports so labels are not squeezed into 2-col leftovers", () => {
    const className = heroSummaryClusterClass(3);
    expect(className).toContain("grid-cols-1");
    expect(className).toContain("sm:grid-cols-3");
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
