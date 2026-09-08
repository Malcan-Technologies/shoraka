import { readFileSync } from "fs";
import { join } from "path";

const portalPeople = readFileSync(
  join(__dirname, "../../../../packages/ui/src/portal-people-section.tsx"),
  "utf8"
);
const issuerWrapper = readFileSync(join(__dirname, "issuer-people-section.tsx"), "utf8");

describe("issuer People section", () => {
  it("keeps one People list and does not reintroduce a ComRep parties card", () => {
    expect(portalPeople.match(/People/g)?.length).toBeGreaterThan(0);
    expect(issuerWrapper).toContain('portal="issuer"');
    expect(portalPeople).not.toContain("Regulatory Parties");
    expect(portalPeople).not.toContain("ComRep Parties");
  });

  it("offers View details and Edit on master and people-only cards", () => {
    expect(portalPeople).toContain("View details");
    expect(portalPeople).toContain("onEdit={canEdit ? () => setEditPartyId(item.party.id) : undefined}");
    expect(portalPeople).toContain("onView={() => setViewPeopleOnlyKey(person.matchKey)}");
    expect(portalPeople).toContain("setAddInitial");
  });

  it("lets issuer owners and org admins mark people inactive", () => {
    expect(issuerWrapper).toContain("canInactivate={canEdit}");
    expect(portalPeople).toContain("Mark inactive");
    expect(portalPeople).toContain('<h3 className="text-card-title">Inactive</h3>');
  });
});
