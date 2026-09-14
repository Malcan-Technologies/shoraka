import { parseGuarantorsFromBusinessDetails } from "./utils";

describe("guarantor utils", () => {
  it("parses guarantors from business details payload", () => {
    const rows = parseGuarantorsFromBusinessDetails({
      guarantors: [
        {
          guarantor_type: "individual",
          email: "person@example.com",
          name: "Jane Doe",
          ic_number: "900101101234",
          nationality: "MY",
          reference_id: "g-individual-1",
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      guarantorId: "g-individual-1",
      guarantorType: "individual",
      email: "person@example.com",
      name: "Jane Doe",
      icNumber: "900101101234",
    });
  });
});
