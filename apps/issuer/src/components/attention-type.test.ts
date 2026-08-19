import { ATTENTION_KIND_LABELS, attentionKindFromApplicationType } from "./attention-type";

describe("attentionKindFromApplicationType", () => {
  it("maps financing types and leaves generic drafts untyped", () => {
    expect(attentionKindFromApplicationType("Facility financing")).toBe("facility");
    expect(attentionKindFromApplicationType("Invoice financing")).toBe("invoice");
    expect(attentionKindFromApplicationType("Generic")).toBeNull();
    expect(ATTENTION_KIND_LABELS.facility).toBe("Facility");
    expect(ATTENTION_KIND_LABELS.invoice).toBe("Invoice");
  });
});
