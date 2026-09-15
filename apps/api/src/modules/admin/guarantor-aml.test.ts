import {
  buildOrganizationGuarantorKey,
  getDeterministicGuarantorId,
  mapRegTankDjkycMessageToPrisma,
  mapRegTankDjkycStatusToPrismaAmlStatus,
  readGuarantorAmlStore,
  upsertGuarantorAmlRecord,
} from "./guarantor-aml";

describe("guarantor-aml helpers", () => {
  it("reuses the same individual key for same government id regardless of formatting", () => {
    const a = buildOrganizationGuarantorKey({
      guarantorType: "individual",
      icNumber: "901212-10-1234",
      email: "first@example.com",
    });
    const b = buildOrganizationGuarantorKey({
      guarantorType: "individual",
      icNumber: "901212101234",
      email: "second@example.com",
    });
    expect(a).toBe("individual:901212101234");
    expect(a).toBe(b);
  });

  it("reuses the same company key for same business id regardless of formatting", () => {
    const a = buildOrganizationGuarantorKey({
      guarantorType: "company",
      ssmNumber: " 1234567-a ",
      email: "ops@company.my",
    });
    const b = buildOrganizationGuarantorKey({
      guarantorType: "company",
      ssmNumber: "1234567-A",
      email: "legal@company.my",
    });
    expect(a).toBe("company:1234567A");
    expect(a).toBe(b);
  });

  it("updates existing record in store by organization guarantor key", () => {
    const now = new Date().toISOString();
    const store = readGuarantorAmlStore({
      guarantors: [
        {
          orgGuarantorKey: "individual:901212101234",
          guarantorType: "individual",
          guarantorId: "g-individual-one",
          applicationId: "app-a",
          linkedApplicationIds: ["app-a"],
          email: "one@example.com",
          amlStatus: "Pending",
          amlMessageStatus: "PENDING",
          triggeredAt: now,
          lastSyncedAt: now,
          lastUpdated: now,
        },
      ],
    });

    const updated = upsertGuarantorAmlRecord(store, {
      orgGuarantorKey: "individual:901212101234",
      guarantorType: "individual",
      guarantorId: "g-individual-one",
      applicationId: "app-b",
      linkedApplicationIds: ["app-a", "app-b"],
      email: "one@example.com",
      amlStatus: "Approved",
      amlMessageStatus: "DONE",
      triggeredAt: now,
      lastSyncedAt: now,
      lastUpdated: now,
    });

    expect(updated.guarantors).toHaveLength(1);
    expect(updated.guarantors[0]?.applicationId).toBe("app-b");
    expect(updated.guarantors[0]?.amlStatus).toBe("Approved");
  });

  it("generates deterministic fallback guarantor id", () => {
    const id = getDeterministicGuarantorId(0, "company", undefined, "1234567-A");
    expect(id).toBe("g-company-1234567a");
  });

  it("maps RegTank Dow Jones status strings to guarantor aml_status", () => {
    expect(mapRegTankDjkycStatusToPrismaAmlStatus("Approved")).toBe("Approved");
    expect(mapRegTankDjkycStatusToPrismaAmlStatus("No Match")).toBe("Unresolved");
    expect(mapRegTankDjkycStatusToPrismaAmlStatus("Positive Match")).toBe("Unresolved");
    expect(mapRegTankDjkycStatusToPrismaAmlStatus("Score Generated")).toBe("Pending");
    expect(mapRegTankDjkycMessageToPrisma("DONE")).toBe("DONE");
    expect(mapRegTankDjkycMessageToPrisma("PENDING")).toBe("PENDING");
  });
});
