import { isValidProfilePhone, normalizeProfilePhone, storedProfilePhone } from "./profile-phone";

describe("profile phone normalization (same as PhoneInput defaultCountry=MY)", () => {
  it("CASE D: accepts a local Malaysian number and stores E.164", () => {
    expect(normalizeProfilePhone("0182316817")).toBe("+60182316817");
    expect(isValidProfilePhone("0182316817")).toBe(true);
    expect(storedProfilePhone("0182316817")).toBe("+60182316817");
  });

  it("CASE E: accepts an international E.164 number as-is", () => {
    expect(normalizeProfilePhone("+447911123456")).toBe("+447911123456");
    expect(isValidProfilePhone("+447911123456")).toBe(true);
  });

  it("accepts an already stored Malaysian E.164 number", () => {
    expect(normalizeProfilePhone("+60182316817")).toBe("+60182316817");
  });

  it("rejects incomplete and non-phone values", () => {
    expect(isValidProfilePhone("123")).toBe(false);
    expect(isValidProfilePhone("not-a-phone")).toBe(false);
    expect(normalizeProfilePhone("")).toBeNull();
    expect(storedProfilePhone("")).toBe("");
    expect(storedProfilePhone(null)).toBeNull();
  });
});
