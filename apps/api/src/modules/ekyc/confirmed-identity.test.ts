import { AppError } from "../../lib/http/error-handler";
import {
  maskMalaysianIcNumber,
  parseConfirmedEkycIdentity,
} from "./confirmed-identity";

describe("parseConfirmedEkycIdentity", () => {
  it("returns null when both fields are omitted", () => {
    expect(parseConfirmedEkycIdentity({})).toBeNull();
  });

  it("normalizes confirmed name and IC number", () => {
    expect(
      parseConfirmedEkycIdentity({
        confirmedName: "  lucas   deng  ",
        confirmedIcNumber: "820508-10-5871",
      })
    ).toEqual({
      name: "LUCAS DENG",
      icNumber: "820508105871",
    });
  });

  it("rejects partial confirmed identity", () => {
    expect(() =>
      parseConfirmedEkycIdentity({
        confirmedName: "LUCAS DENG",
      })
    ).toThrow(AppError);
  });

  it("rejects invalid IC numbers", () => {
    expect(() =>
      parseConfirmedEkycIdentity({
        confirmedName: "LUCAS DENG",
        confirmedIcNumber: "123",
      })
    ).toThrow(AppError);
  });
});

describe("maskMalaysianIcNumber", () => {
  it("masks the middle digits of a 12-digit IC", () => {
    expect(maskMalaysianIcNumber("820508105871")).toBe("820508•••871");
  });
});
