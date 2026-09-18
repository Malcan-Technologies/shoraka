import { buildIssuerProfileIncompleteChecklistModel, buildIssuerProfileSectionLink } from "./profile-incomplete-checklist";
import type { ProfileMissingItem } from "@cashsouk/types";

describe("profile-incomplete-checklist helper", () => {
  test("groups missing fields into issuer profile sections with anchors", () => {
    const missing: ProfileMissingItem[] = [
      { step: "company", field: "companyActivities", label: "Company activities" },
      {
        step: "shareholders",
        field: "designation",
        label: "Designation",
        partyName: "Alice",
      },
      { step: "financials", field: "questionnaire", label: "Financial info" },
    ];

    const model = buildIssuerProfileIncompleteChecklistModel({
      complete: false,
      percent: 35,
      missing,
    });

    expect(model.complete).toBe(false);
    expect(model.percent).toBe(35);

    const byId = new Map(model.sections.map((s) => [s.id, s]));

    expect(byId.get("about")?.href).toBe("#profile-about");
    expect(byId.get("about")?.items.map((i) => i.label)).toEqual(["Company activities"]);
    expect(byId.get("about")?.items[0]?.personName ?? null).toBeNull();

    expect(byId.get("people")?.href).toBe("#profile-people");
    expect(byId.get("people")?.items).toEqual([
      { label: "Designation", personName: "Alice" },
    ]);

    expect(byId.get("financials")?.href).toBe("#profile-financials");
    expect(byId.get("financials")?.items.map((i) => i.label)).toEqual(["Financial info"]);
  });

  test("builds direct /profile links with tab + existing anchor", () => {
    expect(buildIssuerProfileSectionLink({ id: "people", href: "#profile-people" })).toBe(
      "/profile?tab=people#profile-people"
    );
    expect(buildIssuerProfileSectionLink({ id: "company", href: "#profile-company" })).toBe(
      "/profile?tab=profile#profile-company"
    );
  });
});

