import { parseRegTankCodAddresses } from "./cod-addresses";

describe("parseRegTankCodAddresses", () => {
  it("maps distinct registered and business line/state/postcode fields (scenario A)", () => {
    const addresses = parseRegTankCodAddresses([
      { fieldName: "Address (line 1)", fieldValue: "B operating street" },
      { fieldName: "State", fieldValue: "Kuala Lumpur" },
      { fieldName: "Postal code", fieldValue: "50000" },
      { fieldName: "Address line 1 (Registered Address)", fieldValue: "A registered street" },
      { fieldName: "State (Registered Address)", fieldValue: "Selangor" },
      { fieldName: "Postal code (Registered Address)", fieldValue: "47800" },
    ]);

    expect(addresses.registered).toEqual(
      expect.objectContaining({
        line1: "A registered street",
        state: "Selangor",
        postalCode: "47800",
      })
    );
    expect(addresses.business).toEqual(
      expect.objectContaining({
        line1: "B operating street",
        state: "Kuala Lumpur",
        postalCode: "50000",
      })
    );
  });

  it("does not copy address line or state into postcode", () => {
    const addresses = parseRegTankCodAddresses([
      { fieldName: "Address (line 1)", fieldValue: "123 Jalan ABC" },
      { fieldName: "State", fieldValue: "Selangor" },
      { fieldName: "Postal code", fieldValue: "47800" },
      { fieldName: "Address line 1 (Registered Address)", fieldValue: "123 Jalan ABC" },
      { fieldName: "State (Registered Address)", fieldValue: "Selangor" },
      { fieldName: "Postal code (Registered Address)", fieldValue: "47800" },
    ]);

    expect(addresses.registered.line1).toBe("123 Jalan ABC");
    expect(addresses.registered.postalCode).toBe("47800");
    expect(addresses.business.line1).toBe("123 Jalan ABC");
    expect(addresses.business.postalCode).toBe("47800");
    expect(addresses.registered.postalCode).not.toBe(addresses.registered.line1);
    expect(addresses.registered.postalCode).not.toBe(addresses.registered.state);
  });

  it("does not use the business Postal code field as the registered postcode", () => {
    const addresses = parseRegTankCodAddresses([
      { fieldName: "Postal code", fieldValue: "50000" },
      { fieldName: "Postal code (Registered Address)", fieldValue: "47800" },
    ]);
    expect(addresses.business.postalCode).toBe("50000");
    expect(addresses.registered.postalCode).toBe("47800");
  });

  it("maps a plain Address field to the business line, never to postcode", () => {
    const addresses = parseRegTankCodAddresses([
      { fieldName: "Address", fieldValue: "123 Jalan ABC" },
      { fieldName: "Postal code", fieldValue: "47800" },
    ]);
    expect(addresses.business.line1).toBe("123 Jalan ABC");
    expect(addresses.business.postalCode).toBe("47800");
    expect(addresses.business.postalCode).not.toBe(addresses.business.line1);
  });
});
