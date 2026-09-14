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

  it("does not treat the Registered Address section header as line 1", () => {
    const addresses = parseRegTankCodAddresses([
      { fieldName: "Address (line 1)", fieldType: "text", fieldValue: "address (line 1)" },
      { fieldName: "Registered Address", fieldType: "header", fieldValue: "" },
      {
        fieldName: "Address line 1 (Registered Address)",
        fieldType: "text",
        fieldValue: "Address (line 1)",
      },
      { fieldName: "Address line 2 (Registered Address)", fieldType: "text", fieldValue: "Address (line 2)" },
      { fieldName: "City (Registered Address)", fieldType: "text", fieldValue: "City" },
      { fieldName: "Postal code (Registered Address)", fieldType: "number", fieldValue: "47300" },
      { fieldName: "State (Registered Address)", fieldType: "picklist", fieldValue: "Johor" },
      { fieldName: "Country (Registered Address)", fieldType: "picklist", fieldValue: "Malaysia" },
    ]);
    expect(addresses.registered).toEqual({
      line1: "Address (line 1)",
      line2: "Address (line 2)",
      city: "City",
      postalCode: "47300",
      state: "Johor",
      country: "Malaysia",
    });
    expect(addresses.business.line1).toBe("address (line 1)");
  });
});
