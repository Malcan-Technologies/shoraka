import { createPartySchema } from "./schemas";
import { formatZodMessage } from "../../lib/http/error-handler";
import { SELECT_AT_LEAST_ONE_ROLE_MESSAGE } from "@cashsouk/types";
import { ZodError } from "zod";

const identity = {
  entityType: "INDIVIDUAL" as const,
  name: "Random 1",
  identityPrefix: "NRIC" as const,
  identityNumber: "021116101341",
  dateOfBirth: "2002-11-16",
  gender: "MALE" as const,
  nationality: "MALAYSIA",
  address: { line1: "12341", state: "Kelantan", postalCode: "12341" },
};

const officerFields = {
  designation: "CHIEF_EXECUTIVE_OFFICER" as const,
  appointmentDate: "2026-09-25",
};

function parseMessage(payload: Record<string, unknown>): string {
  const result = createPartySchema.safeParse(payload);
  if (result.success) return "";
  return formatZodMessage(result.error);
}

describe("createPartySchema role flags", () => {
  it("CASE A: Director only saves without personKind", () => {
    const parsed = createPartySchema.parse({
      ...identity,
      isDirector: true,
      isShareholder: false,
      isBoard: false,
      isManagement: false,
    });
    expect(parsed.isDirector).toBe(true);
    expect(parsed.isBoard).toBe(false);
    expect(parsed.isManagement).toBe(false);
    expect(parsed.personKind ?? null).toBeNull();
  });

  it("CASE B: Board only saves without personKind", () => {
    const parsed = createPartySchema.parse({
      ...identity,
      isDirector: false,
      isShareholder: false,
      isBoard: true,
      isManagement: false,
      ...officerFields,
    });
    expect(parsed.isBoard).toBe(true);
    expect(parsed.isManagement).toBe(false);
  });

  it("CASE C: Management only saves without personKind", () => {
    const parsed = createPartySchema.parse({
      ...identity,
      isDirector: false,
      isShareholder: false,
      isBoard: false,
      isManagement: true,
      ...officerFields,
    });
    expect(parsed.isManagement).toBe(true);
    expect(parsed.isBoard).toBe(false);
  });

  it("CASE D/H: Director + Board + Management is one person with both officer roles", () => {
    const parsed = createPartySchema.parse({
      ...identity,
      isDirector: true,
      isShareholder: false,
      isBoard: true,
      isManagement: true,
      ...officerFields,
    });
    expect(parsed.isDirector).toBe(true);
    expect(parsed.isBoard).toBe(true);
    expect(parsed.isManagement).toBe(true);
    expect(parseMessage({
      ...identity,
      isDirector: true,
      isBoard: true,
      isManagement: true,
      ...officerFields,
    })).not.toMatch(/personKind/i);
  });

  it("CASE E: Director + Shareholder >=5% saves without Board fields", () => {
    const parsed = createPartySchema.parse({
      ...identity,
      isDirector: true,
      isShareholder: true,
      isBoard: false,
      isManagement: false,
      shareType: "ORDINARY",
      shareholdingUnits: "10",
      shareholdingAmount: "10",
      shareholdingPercentage: "6",
    });
    expect(parsed.isDirector).toBe(true);
    expect(parsed.isShareholder).toBe(true);
  });

  it("CASE F: no roles returns Select at least one role", () => {
    expect(
      parseMessage({
        ...identity,
        isDirector: false,
        isShareholder: false,
        isBoard: false,
        isManagement: false,
      })
    ).toBe(SELECT_AT_LEAST_ONE_ROLE_MESSAGE);
  });

  it("CASE G: Board without Designation returns a Designation error, not personKind", () => {
    const message = parseMessage({
      ...identity,
      isBoard: true,
      appointmentDate: "2026-09-25",
    });
    expect(message).toMatch(/Designation/);
    expect(message).not.toMatch(/personKind/i);
  });
});

describe("formatZodMessage", () => {
  it("does not invent a personKind error for a valid ZodError without that path", () => {
    const err = new ZodError([
      { code: "custom", path: ["designation"], message: "Select a Designation." },
    ]);
    expect(formatZodMessage(err)).toBe("designation: Select a Designation.");
  });
});
