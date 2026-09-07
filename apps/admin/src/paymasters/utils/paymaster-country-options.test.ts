import { paymasterCountryOptions } from "./paymaster-country-options";

describe("paymasterCountryOptions", () => {
  it("does not call Intl.supportedValuesOf", () => {
    const spy = jest.spyOn(Intl, "supportedValuesOf").mockImplementation(() => {
      throw new RangeError('invalid key: "region"');
    });
    expect(() => paymasterCountryOptions("MY")).not.toThrow();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("includes Malaysia and names it", () => {
    const malaysia = paymasterCountryOptions("MY").find((country) => country.code === "MY");
    expect(malaysia).toEqual({ code: "MY", name: "Malaysia" });
  });

  it("keeps an existing ISO code that is not in the default list", () => {
    const codes = paymasterCountryOptions("nz").map((country) => country.code);
    expect(codes).toContain("NZ");
    expect(codes).toContain("MY");
  });
});
