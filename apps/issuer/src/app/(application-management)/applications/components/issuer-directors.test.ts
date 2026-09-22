import fs from "node:fs";
import path from "node:path";
import type { ApplicationPersonRow } from "@cashsouk/types";
import {
  areIssuerDirectorSelectionsReady,
  issuerDirectorSelectionIssue,
  issuerDirectorsFromPeople,
} from "./issuer-directors";

function person(overrides: Partial<ApplicationPersonRow> & Pick<ApplicationPersonRow, "matchKey" | "name">): ApplicationPersonRow {
  return {
    entityType: "INDIVIDUAL",
    roles: ["DIRECTOR"],
    sharePercentage: null,
    status: "",
    email: "director@co.my",
    ...overrides,
  };
}

describe("issuerDirectorsFromPeople", () => {
  it("fills IC from identityNumber when matchKey is a generated user key", () => {
    const directors = issuerDirectorsFromPeople([
      person({
        matchKey: "user:abc",
        name: "Normal Director",
        identityNumber: "820508105871",
        email: "sec.practitioner@proton.me",
      }),
    ]);
    expect(directors).toEqual([
      {
        matchKey: "user:abc",
        name: "Normal Director",
        email: "sec.practitioner@proton.me",
        ic_number: "820508105871",
      },
    ]);
  });

  it("keeps a CTOS-style NRIC matchKey as IC when identityNumber is absent", () => {
    const directors = issuerDirectorsFromPeople([
      person({
        matchKey: "820508105871",
        name: "Ali Bin Abu",
        email: "ali@co.my",
      }),
    ]);
    expect(directors[0]?.ic_number).toBe("820508105871");
  });

  it("ignores shareholders and corporate rows", () => {
    expect(
      issuerDirectorsFromPeople([
        person({
          matchKey: "880202025555",
          name: "Only Shareholder",
          roles: ["SHAREHOLDER"],
        }),
        person({
          matchKey: "1234567A",
          name: "HoldCo",
          entityType: "CORPORATE",
        }),
      ])
    ).toEqual([]);
  });

  it("does not invent directors from empty people[]", () => {
    expect(issuerDirectorsFromPeople([])).toEqual([]);
    expect(issuerDirectorsFromPeople(undefined)).toEqual([]);
  });

  it("does not fall back to KYC or AML director lists", () => {
    const source = fs.readFileSync(path.join(__dirname, "issuer-directors.ts"), "utf8");
    expect(source).not.toContain("directorKycStatus");
    expect(source).not.toContain("directorAmlStatus");
    expect(source).not.toContain("issuerDirectorsFromOrganization");
  });
});

describe("issuerDirectorSelectionIssue", () => {
  it("requires a 12-digit IC on the selected people[] director", () => {
    const directors = issuerDirectorsFromPeople([
      person({
        matchKey: "user:abc",
        name: "Normal Director",
        identityNumber: null,
        email: "sec.practitioner@proton.me",
      }),
    ]);
    expect(issuerDirectorSelectionIssue(directors, ["user:abc"])).toEqual({
      kind: "missing_ic",
    });
    expect(areIssuerDirectorSelectionsReady(directors, ["user:abc"])).toBe(false);
  });

  it("names a blank Person Email instead of treating the director as unselected", () => {
    const directors = issuerDirectorsFromPeople([
      person({
        matchKey: "911118075495",
        name: "Lim Tze Yang",
        identityNumber: "911118075495",
        email: "",
      }),
    ]);
    expect(issuerDirectorSelectionIssue(directors, ["911118075495"])).toEqual({
      kind: "missing_email",
    });
    expect(areIssuerDirectorSelectionsReady(directors, ["911118075495"])).toBe(false);
  });

  it("reports no selection when the dropdown is empty", () => {
    const directors = issuerDirectorsFromPeople([
      person({
        matchKey: "911118075495",
        name: "Lim Tze Yang",
        identityNumber: "911118075495",
      }),
    ]);
    expect(issuerDirectorSelectionIssue(directors, [])).toEqual({
      kind: "none_selected",
    });
  });
});
