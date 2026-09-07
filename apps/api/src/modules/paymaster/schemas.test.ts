import { updatePaymasterBodySchema, verifyPaymasterBodySchema } from "./schemas";

describe("Paymaster official identity schemas", () => {
  it("requires legal name, country, and entity type and ignores SSM", () => {
    expect(() =>
      updatePaymasterBodySchema.parse({
        legalName: "",
        country: "MY",
        entityType: "Private Limited Company (Sdn Bhd)",
      })
    ).toThrow();
    const parsed = updatePaymasterBodySchema.parse({
      legalName: "ABC Trading Sdn. Bhd.",
      country: "MY",
      entityType: "Private Limited Company (Sdn Bhd)",
      registrationNumber: "999999999999",
    });
    expect(parsed).toEqual({
      legalName: "ABC Trading Sdn. Bhd.",
      country: "MY",
      entityType: "Private Limited Company (Sdn Bhd)",
    });
    expect(parsed).not.toHaveProperty("registrationNumber");
  });

  it("allows verify without identity fields and still ignores SSM", () => {
    expect(verifyPaymasterBodySchema.parse({ applicationId: "app-1" })).toEqual({
      applicationId: "app-1",
    });
    const parsed = verifyPaymasterBodySchema.parse({
      legalName: "Official Name",
      country: "MY",
      entityType: "Partnership",
      registrationNumber: "202134567890",
    });
    expect(parsed).toEqual({
      legalName: "Official Name",
      country: "MY",
      entityType: "Partnership",
    });
    expect(parsed).not.toHaveProperty("registrationNumber");
  });
});
