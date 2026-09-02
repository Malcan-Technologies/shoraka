import { certificateNumberFor, investorScheduleReferenceFor } from "./types";

describe("certificate identifier derivation", () => {
  it("certificate number is IINC- prefixed onto notes.note_reference", () => {
    expect(certificateNumberFor("NOTE-ARF-202609-5O3")).toBe("IINC-NOTE-ARF-202609-5O3");
  });

  it("investor schedule reference is IS- + note_reference + -version", () => {
    expect(investorScheduleReferenceFor("NOTE-ARF-202609-5O3", "V01")).toBe(
      "IS-NOTE-ARF-202609-5O3-V01"
    );
  });
});
