import { visibleSigningEnvelopesWhere } from "./repository";

describe("visibleSigningEnvelopesWhere", () => {
  it("lists only this application when there is no facility", () => {
    expect(visibleSigningEnvelopesWhere("app-1", null)).toEqual({
      application_id: "app-1",
    });
  });

  it("includes a completed facility package on the same contract", () => {
    expect(visibleSigningEnvelopesWhere("app-draw", "ctr-1")).toEqual({
      OR: [
        { application_id: "app-draw" },
        { contract_id: "ctr-1", invoice_id: null, status: "COMPLETED" },
      ],
    });
  });
});
