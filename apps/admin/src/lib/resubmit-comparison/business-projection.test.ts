import type { ReviewApplicationView } from "@/components/application-review/section-content";
import { comparisonRowDiffers, replacedComparisonFiles } from "./projection-types";
import {
  businessComparisonHasChanges,
  businessGuarantorBlockSubtitle,
  projectBusinessComparison,
} from "./business-projection";

type Json = Record<string, unknown>;

function guarantorEntry(overrides: Json = {}, sourceOverrides: Json = {}): Json {
  return {
    id: "link-1",
    client_guarantor_id: "cg-1",
    guarantor_type: "individual",
    email: "Siti@Example.test",
    name: "Siti Aminah",
    ic_number: "900101-14-1234",
    business_name: null,
    ssm_number: null,
    position: 0,
    source_data: {
      nationality: "MY",
      relationship: "family_members_of_director",
      guarantor_agreement: {
        s3_key: "g/agreement-1",
        file_name: "agreement.pdf",
        file_size: 4096,
        uploaded_at: "2026-01-01T00:00:00Z",
      },
      ...sourceOverrides,
    },
    aml_status: "Pending",
    aml_message_status: "PENDING",
    last_triggered_at: null,
    last_synced_at: null,
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function companyGuarantorEntry(overrides: Json = {}): Json {
  return {
    id: "link-2",
    client_guarantor_id: "cg-2",
    guarantor_type: "company",
    email: "ops@holdco.test",
    name: null,
    ic_number: null,
    business_name: "HoldCo Sdn Bhd",
    ssm_number: "201901000001",
    position: 1,
    source_data: { relationship: "parent_company" },
    aml_status: "Pending",
    aml_message_status: "PENDING",
    ...overrides,
  };
}

function details(overrides: Json = {}, whyOverrides: Json = {}): Json {
  return {
    why_raising_funds: {
      sc_purpose_of_fund_raising: "WORKING_CAPITAL",
      how_funds_used: "Buy stock",
      business_plan: "Grow",
      risks_delay_repayment: "None",
      backup_plan: "Savings",
      raising_on_other_p2p: false,
      supporting_documents: [
        { s3_key: "d/plan", file_name: "plan.pdf", file_size: 1024, uploaded_at: "2026-01-01T00:00:00Z" },
        { s3_key: "d/cash", file_name: "cash.pdf" },
      ],
      ...whyOverrides,
    },
    declaration_confirmed: true,
    ...overrides,
  };
}

function app(opts: {
  details?: Json | null;
  guarantors?: Json[];
  declarations?: unknown;
} = {}): ReviewApplicationView {
  return {
    business_details: opts.details === undefined ? details() : opts.details,
    application_guarantors: opts.guarantors ?? [guarantorEntry(), companyGuarantorEntry()],
    declarations: opts.declarations ?? { accepted: true },
  };
}

function changedLabels(before: ReviewApplicationView, after: ReviewApplicationView): string[] {
  return projectBusinessComparison(before, after).flatMap((b) =>
    b.rows.filter(comparisonRowDiffers).map((r) => `${b.title} / ${r.label}`)
  );
}

describe("projectBusinessComparison — layout", () => {
  it("emits why, one block per guarantor, then declarations with live labels and order", () => {
    const blocks = projectBusinessComparison(app(), app());
    expect(blocks.map((b) => b.id)).toEqual([
      "why_raising_funds",
      "guarantor:0",
      "guarantor:1",
      "declarations",
    ]);
    expect(blocks[1]!.title).toBe("Guarantor 1");
    expect(blocks[1]!.rows.map((r) => r.label)).toEqual([
      "Guarantor type",
      "Name",
      "IC number",
      "Nationality",
      "Relationship",
      "Email",
      "Guarantor agreement",
    ]);
    expect(blocks[2]!.rows.map((r) => r.label)).toEqual([
      "Guarantor type",
      "Business name",
      "SSM number",
      "Relationship",
      "Email",
      "Guarantor agreement",
    ]);
    expect(blocks[1]!.rows.find((r) => r.label === "Nationality")).toMatchObject({ after: "Malaysia (MY)" });
    expect(blocks[1]!.rows.find((r) => r.label === "Email")).toMatchObject({ after: "siti@example.test" });
    expect(businessGuarantorBlockSubtitle(blocks[1]!)).toBe("Siti Aminah");
    expect(businessGuarantorBlockSubtitle(blocks[2]!)).toBe("HoldCo Sdn Bhd");
    expect(businessComparisonHasChanges(app(), app())).toBe(false);
  });

  it("guarantor subtitle falls back to the before name when the after name is blank", () => {
    const after = app({ guarantors: [guarantorEntry({ name: "  " }), companyGuarantorEntry({ business_name: null })] });
    const blocks = projectBusinessComparison(app(), after);
    expect(businessGuarantorBlockSubtitle(blocks[1]!)).toBe("Siti Aminah");
    expect(businessGuarantorBlockSubtitle(blocks[2]!)).toBe("HoldCo Sdn Bhd");
    const bothBlank = projectBusinessComparison(after, after);
    expect(businessGuarantorBlockSubtitle(bothBlank[1]!)).toBe("");
  });

  it("returns no blocks when neither snapshot has business_details or guarantors", () => {
    expect(
      projectBusinessComparison(app({ details: null, guarantors: [] }), app({ details: null, guarantors: [] }))
    ).toEqual([]);
  });

  it("still compares relational guarantors when neither snapshot has business_details", () => {
    const before = app({ details: null, guarantors: [guarantorEntry()] });
    const after = app({
      details: null,
      guarantors: [guarantorEntry({}, { relationship: "director_shareholder" })],
    });
    const blocks = projectBusinessComparison(before, after);
    expect(blocks.map((b) => b.id)).toEqual(["guarantor:0"]);
    expect(changedLabels(before, after)).toEqual(["Guarantor 1 / Relationship"]);
    expect(businessComparisonHasChanges(before, after)).toBe(true);
    expect(businessComparisonHasChanges(before, before)).toBe(false);
  });

  it("a missing before business_details reads as empty, not as the after side", () => {
    expect(businessComparisonHasChanges(app({ details: null }), app())).toBe(true);
  });

  it("falls back to snapshot application.guarantors like SectionContent", () => {
    const after = { ...app({ guarantors: [] }), application: { guarantors: [guarantorEntry()] } };
    const blocks = projectBusinessComparison(app({ guarantors: [guarantorEntry()] }), after);
    expect(blocks.filter((b) => b.id.startsWith("guarantor:"))).toHaveLength(1);
    expect(businessComparisonHasChanges(app({ guarantors: [guarantorEntry()] }), after)).toBe(false);
  });

  it("shows P2P follow-up rows only when either side answered yes", () => {
    const ids = (a: ReviewApplicationView) => projectBusinessComparison(a, a)[0]!.rows.map((r) => r.key);
    expect(ids(app())).not.toContain("platform_name");
    const yes = app({ details: details({}, { raising_on_other_p2p: true, amount_raised: 5000 }) });
    expect(ids(yes)).toEqual(expect.arrayContaining(["platform_name", "amount_raised", "same_invoice_used"]));
    expect(projectBusinessComparison(yes, yes)[0]!.rows.find((r) => r.key === "amount_raised")).toMatchObject({
      after: expect.stringMatching(/^RM 5,000\.00$/),
    });
  });
});

describe("projectBusinessComparison — must NOT diff", () => {
  it("guarantor aml status, message status, positions, client ids and timestamps", () => {
    const after = app({
      guarantors: [
        guarantorEntry({
          aml_status: "Approved",
          aml_message_status: "DONE",
          position: 5,
          client_guarantor_id: "cg-99",
          last_triggered_at: "2026-02-02T00:00:00Z",
          last_synced_at: "2026-02-02T00:00:00Z",
          updated_at: "2026-02-02T00:00:00Z",
        }),
        companyGuarantorEntry({ position: 6, aml_status: "Rejected", client_guarantor_id: "cg-98" }),
      ],
    });
    expect(changedLabels(app(), after)).toEqual([]);
  });

  it("uploaded_at re-hydrated on supporting documents and guarantor agreements", () => {
    const after = app({
      details: details({}, {
        supporting_documents: [
          { s3_key: "d/cash", file_name: "cash.pdf", uploaded_at: "2026-03-03T00:00:00Z" },
          { s3_key: "d/plan", file_name: "plan.pdf", file_size: 2048, uploaded_at: "2026-03-03T00:00:00Z" },
        ],
      }),
      guarantors: [
        guarantorEntry({}, {
          guarantor_agreement: {
            s3_key: "g/agreement-1",
            file_name: "agreement.pdf",
            uploaded_at: "2026-03-03T00:00:00Z",
          },
        }),
        companyGuarantorEntry(),
      ],
    });
    expect(changedLabels(app(), after)).toEqual([]);
  });

  it("financing_for and other unrendered business_details keys", () => {
    const after = app({ details: details({ financing_for: "Something else", internal_note: "x" }) });
    expect(businessComparisonHasChanges(app(), after)).toBe(false);
  });

  it("null vs empty string on optional P2P fields", () => {
    const before = app({ details: details({}, { raising_on_other_p2p: true, platform_name: null, amount_raised: null }) });
    const after = app({ details: details({}, { raising_on_other_p2p: true, platform_name: "", amount_raised: "" }) });
    expect(businessComparisonHasChanges(before, after)).toBe(false);
  });

  it("hidden P2P follow-ups changing while both sides answered no", () => {
    const after = app({ details: details({}, { platform_name: "OtherP2P" }) });
    expect(businessComparisonHasChanges(app(), after)).toBe(false);
  });

  it("app.declarations changes with the same declaration_confirmed", () => {
    expect(businessComparisonHasChanges(app(), app({ declarations: { accepted: false, at: "now" } }))).toBe(false);
  });
});

describe("projectBusinessComparison — MUST diff", () => {
  it("relationship change is a visible Relationship row", () => {
    const after = app({ guarantors: [guarantorEntry({}, { relationship: "director_shareholder" }), companyGuarantorEntry()] });
    expect(changedLabels(app(), after)).toEqual(["Guarantor 1 / Relationship"]);
    const row = projectBusinessComparison(app(), after)[1]!.rows.find((r) => r.label === "Relationship");
    expect(row).toMatchObject({ before: "Family members of director", after: "Director / shareholder" });
  });

  it("relationship_other text is shown and diffed for 'others'", () => {
    const before = app({ guarantors: [guarantorEntry({}, { relationship: "others", relationship_other: "Cousin" })] });
    const after = app({ guarantors: [guarantorEntry({}, { relationship: "others", relationship_other: "Uncle" })] });
    const row = projectBusinessComparison(before, after)[1]!.rows.find((r) => r.label === "Relationship")!;
    expect(row).toMatchObject({ before: expect.stringContaining("Cousin"), after: expect.stringContaining("Uncle") });
    expect(comparisonRowDiffers(row)).toBe(true);
  });

  it("guarantor added", () => {
    const before = app({ guarantors: [guarantorEntry()] });
    expect(changedLabels(before, app())).toContain("Guarantor 2 / Guarantor type");
  });

  it("guarantor removed", () => {
    const after = app({ guarantors: [guarantorEntry()] });
    expect(businessComparisonHasChanges(app(), after)).toBe(true);
    const removed = projectBusinessComparison(app(), after)[2]!;
    expect(removed.rows[0]).toMatchObject({ before: "Company", after: "—" });
  });

  it("declaration_confirmed flip", () => {
    const after = app({ details: details({ declaration_confirmed: false }) });
    expect(changedLabels(app(), after)).toEqual(["Declarations / Declarations"]);
  });

  it("guarantor agreement replaced under the same file name", () => {
    const after = app({
      guarantors: [
        guarantorEntry({}, { guarantor_agreement: { s3_key: "g/agreement-2", file_name: "agreement.pdf" } }),
        companyGuarantorEntry(),
      ],
    });
    const row = projectBusinessComparison(app(), after)[1]!.rows.find((r) => r.kind === "files")!;
    expect(comparisonRowDiffers(row)).toBe(true);
    if (row.kind !== "files") return;
    expect(replacedComparisonFiles(row.before, row.after).map((f) => f.s3Key)).toEqual(["g/agreement-2"]);
  });

  it("supporting document added", () => {
    const after = app({
      details: details({}, {
        supporting_documents: [
          { s3_key: "d/plan", file_name: "plan.pdf" },
          { s3_key: "d/cash", file_name: "cash.pdf" },
          { s3_key: "d/new", file_name: "new.pdf" },
        ],
      }),
    });
    expect(changedLabels(app(), after)).toEqual([
      "Why Are You Raising Funds? / Relevant Supporting Documents for This Section",
    ]);
  });
});
