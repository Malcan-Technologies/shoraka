import { summarizeResubmitSnapshotDiff } from "./index";

describe("summarizeResubmitSnapshotDiff", () => {
  const baseApp = {
    financing_type: { product_id: "p1" },
    financing_structure: {},
    company_details: { a: 1 },
    business_details: {},
    financial_statements: {},
    supporting_documents: {},
    declarations: {},
    review_and_submit: {},
    last_completed_step: 5,
    contract_id: null,
  };

  it("detects supporting_documents path changes", () => {
    const prev = {
      application: { ...baseApp, supporting_documents: { categories: [] } },
      contract: null,
      invoices: [],
    };
    const next = {
      application: { ...baseApp, supporting_documents: { categories: [{ name: "X" }] } },
      contract: null,
      invoices: [],
    };
    const s = summarizeResubmitSnapshotDiff(prev, next);
    expect(s.field_changes.some((f) => f.path.includes("supporting_documents"))).toBe(true);
    expect(s.changedSectionKeys).toContain("supporting_documents");
    expect(s.activitySummary.startsWith("Changes:")).toBe(true);
    expect(s.activitySummary).toContain("Supporting documents");
    expect(s.activitySummary).toContain("•");
    const fc = s.field_changes.find((f) => f.path.includes("supporting_documents"));
    expect(fc?.previous_value).toBeDefined();
    expect(fc?.next_value).toBeDefined();
  });

  it("returns no paths when snapshots match", () => {
    const snap = {
      application: baseApp,
      contract: null,
      invoices: [],
    };
    const s = summarizeResubmitSnapshotDiff(snap, snap);
    expect(s.field_changes.length).toBe(0);
  });

  it("ignores contract updated_at-only drift", () => {
    const contractA = {
      id: "c1",
      status: "DRAFT",
      contract_details: { x: 1 },
      created_at: new Date("2024-01-01"),
      updated_at: new Date("2024-01-01"),
    };
    const contractB = {
      ...contractA,
      updated_at: new Date("2026-06-06"),
    };
    const prev = { application: baseApp, contract: contractA, invoices: [] };
    const next = { application: baseApp, contract: contractB, invoices: [] };
    const s = summarizeResubmitSnapshotDiff(prev, next);
    expect(s.field_changes.filter((f) => f.section_key === "contract")).toHaveLength(0);
    expect(s.contractChanged).toBe(false);
  });

  it("still detects real contract field changes after stripping timestamps", () => {
    const contractA = {
      id: "c1",
      status: "DRAFT",
      contract_details: { x: 1 },
      updated_at: new Date("2024-01-01"),
    };
    const contractB = {
      ...contractA,
      contract_details: { x: 2 },
      updated_at: new Date("2024-01-02"),
    };
    const prev = { application: baseApp, contract: contractA, invoices: [] };
    const next = { application: baseApp, contract: contractB, invoices: [] };
    const s = summarizeResubmitSnapshotDiff(prev, next);
    expect(s.contractChanged).toBe(true);
    const contractFc = s.field_changes.find((f) => f.path.includes("contract_details"));
    expect(contractFc).toBeDefined();
    expect(contractFc?.previous_value).toContain("1");
    expect(contractFc?.next_value).toContain("2");
  });

  it("drops invoice rows when only non-UI fields (e.g. status) differ", () => {
    const invId = "inv-1";
    const prev = {
      application: baseApp,
      contract: null,
      invoices: [
        {
          id: invId,
          status: "DRAFT",
          application_id: "app-1",
          details: { amount: 100 },
        },
      ],
    };
    const next = {
      application: baseApp,
      contract: null,
      invoices: [
        {
          id: invId,
          status: "SUBMITTED",
          application_id: "app-1",
          details: { amount: 100 },
        },
      ],
    };
    const s = summarizeResubmitSnapshotDiff(prev, next);
    expect(s.field_changes.some((f) => f.path.includes("status"))).toBe(false);
    expect(s.invoicesChanged).toBe(false);
    expect(s.activitySummary).toContain("none detected");
  });
});
