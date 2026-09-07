import { readFileSync } from "fs";
import { join } from "path";

describe("issuer People section", () => {
  const source = readFileSync(join(__dirname, "issuer-people-section.tsx"), "utf8");

  it("keeps one People list and does not reintroduce a ComRep parties card", () => {
    expect(source.match(/title="People"/g)).toHaveLength(1);
    expect(source).not.toContain("Regulatory Parties");
    expect(source).not.toContain("ComRep Parties");
  });

  it("offers View details and Edit on master people cards regardless of role", () => {
    expect(source).toContain("View details");
    expect(source).toContain("onEdit={canEdit ? () => setEditPartyId(item.party.id) : undefined}");
  });
});
