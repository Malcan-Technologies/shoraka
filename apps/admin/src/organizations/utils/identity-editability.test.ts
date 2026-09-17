import type { ProfileFieldSources, ProfileValueSource } from "@cashsouk/types";
import { isIdentityNumberEditable } from "./identity-editability";

function sources(identityNumberSource?: ProfileValueSource): ProfileFieldSources | undefined {
  if (!identityNumberSource) return undefined;
  return {
    identityNumber: { source: identityNumberSource, updatedAt: "2026-01-01T00:00:00.000Z" },
  };
}

describe("Admin identity number editability", () => {
  test("missing identity number => editable", () => {
    expect(
      isIdentityNumberEditable({
        portal: "investor",
        documentNumber: null,
        profileFieldSources: sources("REGTANK"),
      })
    ).toBe(true);
  });

  test("RegTank-sourced identity number => read-only when present", () => {
    expect(
      isIdentityNumberEditable({
        portal: "investor",
        documentNumber: "S1234567A",
        profileFieldSources: sources("REGTANK"),
      })
    ).toBe(false);
  });

  test("manually saved identity number => editable when source is USER", () => {
    expect(
      isIdentityNumberEditable({
        portal: "investor",
        documentNumber: "S1234567A",
        profileFieldSources: sources("USER"),
      })
    ).toBe(true);
  });
});

