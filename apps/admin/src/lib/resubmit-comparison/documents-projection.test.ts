import type { ReviewApplicationView } from "@/components/application-review/section-content";
import { comparisonRowDiffers, replacedComparisonFiles, type ComparisonRow } from "./projection-types";
import {
  amendmentRemarksForDocumentRow,
  documentsComparisonHasChanges,
  projectDocumentsComparison,
  projectDocumentsComparisonWithSlots,
} from "./documents-projection";

type FileJson = { s3_key: string; file_name: string; file_size?: number; uploaded_at?: string };
type DocJson = { title?: string; files?: FileJson[]; workflow_document_index?: number };
type CategoryJson = { name: string; documents: DocJson[] };

function app(categories: CategoryJson[]): ReviewApplicationView {
  return { supporting_documents: { categories } };
}

const bankStatement = (overrides: Partial<FileJson> = {}): FileJson => ({
  s3_key: "k/bank-1",
  file_name: "bank.pdf",
  file_size: 2048,
  uploaded_at: "2026-01-01T00:00:00Z",
  ...overrides,
});

function base(): CategoryJson[] {
  return [
    {
      name: "Legal Docs",
      documents: [{ title: "SSM Profile", files: [{ s3_key: "k/ssm", file_name: "ssm.pdf" }] }],
    },
    {
      name: "Financial Docs",
      documents: [
        {
          title: "Bank statements",
          files: [bankStatement(), { s3_key: "k/bank-2", file_name: "bank-2.pdf" }],
        },
      ],
    },
  ];
}

function rows(before: ReviewApplicationView, after: ReviewApplicationView): ComparisonRow[] {
  return projectDocumentsComparison(before, after).flatMap((b) => b.rows);
}

describe("projectDocumentsComparison", () => {
  it("keeps categories in payload order like the live DocumentList", () => {
    const blocks = projectDocumentsComparison(app(base()), app(base()));
    expect(blocks.map((b) => [b.id, b.title])).toEqual([
      ["legal_docs", "Legal Docs"],
      ["financial_docs", "Financial Docs"],
    ]);
    expect(documentsComparisonHasChanges(app(base()), app(base()))).toBe(false);
  });

  it("appends categories that only exist before after the current payload order", () => {
    const after = app([base()[1]!]);
    const blocks = projectDocumentsComparison(app(base()), after);
    expect(blocks.map((b) => b.id)).toEqual(["financial_docs", "legal_docs"]);
    expect(documentsComparisonHasChanges(app(base()), after)).toBe(true);
  });

  it("uploaded_at re-hydration, file size and workflow_document_index never count", () => {
    const after = base();
    after[1]!.documents[0] = {
      title: "Bank statements",
      workflow_document_index: 7,
      files: [
        bankStatement({ uploaded_at: "2026-05-05T10:00:00Z", file_size: 999_999 }),
        { s3_key: "k/bank-2", file_name: "bank-2.pdf" },
      ],
    };
    expect(documentsComparisonHasChanges(app(base()), app(after))).toBe(false);
  });

  it("reordered files within a slot do not differ", () => {
    const after = base();
    after[1]!.documents[0]!.files = [...after[1]!.documents[0]!.files!].reverse();
    expect(rows(app(base()), app(after)).some(comparisonRowDiffers)).toBe(false);
  });

  it("a document added to a category differs", () => {
    const after = base();
    after[0]!.documents.push({ title: "Directors IC", files: [{ s3_key: "k/ic", file_name: "ic.pdf" }] });
    const changed = rows(app(base()), app(after)).filter(comparisonRowDiffers);
    expect(changed.map((r) => r.label)).toEqual(["Directors IC"]);
  });

  it("a removed file differs", () => {
    const after = base();
    after[1]!.documents[0]!.files = [bankStatement()];
    expect(documentsComparisonHasChanges(app(base()), app(after))).toBe(true);
  });

  it("same file name under a new s3 key differs and is reported as replaced", () => {
    const after = base();
    after[0]!.documents[0]!.files = [{ s3_key: "k/ssm-v2", file_name: "ssm.pdf" }];
    const row = rows(app(base()), app(after)).find((r) => r.label === "SSM Profile")!;
    expect(row.kind).toBe("files");
    expect(comparisonRowDiffers(row)).toBe(true);
    if (row.kind !== "files") return;
    expect(replacedComparisonFiles(row.before, row.after).map((f) => f.s3Key)).toEqual(["k/ssm-v2"]);
  });

  it("emits display strings the UI shows (file name + size secondary)", () => {
    const row = rows(app(base()), app(base())).find((r) => r.kind === "files" && r.label.startsWith("Bank"));
    expect(row).toMatchObject({
      label: "Bank statements (2 files)",
      after: [
        { s3Key: "k/bank-1", fileName: "bank.pdf", secondary: "2.00 KB" },
        { s3Key: "k/bank-2", fileName: "bank-2.pdf" },
      ],
    });
  });

  it("removing the first slot only flags that slot; later slots keep their own key and label", () => {
    const threeSlots = (): CategoryJson[] => [
      {
        name: "Legal Docs",
        documents: [
          { title: "SSM Profile", files: [{ s3_key: "k/ssm", file_name: "ssm.pdf" }] },
          { title: "Directors IC", files: [{ s3_key: "k/ic", file_name: "ic.pdf" }] },
          { title: "Board Resolution", files: [{ s3_key: "k/br", file_name: "br.pdf" }] },
        ],
      },
    ];
    const after = threeSlots();
    after[0]!.documents.shift();
    const [block] = projectDocumentsComparisonWithSlots(app(threeSlots()), app(after));
    expect(block!.rows.filter(comparisonRowDiffers).map((r) => r.label)).toEqual(["SSM Profile"]);
    expect(block!.rows.map((r) => [r.key, r.label])).toEqual([
      ["legal_docs:b1:a0", "Directors IC"],
      ["legal_docs:b2:a1", "Board Resolution"],
      ["legal_docs:b0:a-", "SSM Profile"],
    ]);
    // Requirement badges: after index (after workflow config); before-only rows get none.
    // Remarks: the before slot's item key.
    expect(block!.rowSlots).toEqual([
      { requirementSlotIndex: 0, remarkScopeKey: "supporting_documents:legal_docs:1:Directors_IC" },
      { requirementSlotIndex: 1, remarkScopeKey: "supporting_documents:legal_docs:2:Board_Resolution" },
      { requirementSlotIndex: null, remarkScopeKey: "supporting_documents:legal_docs:0:SSM_Profile" },
    ]);
  });

  it("row keys stay unique when before-only and after-only slots share index and 32-char slug", () => {
    const fs = (year: string): CategoryJson[] => [
      {
        name: "Financial Docs",
        documents: [
          {
            title: `Audited Financial Statement ${year}`,
            files: [{ s3_key: `k/afs-${year}`, file_name: `afs-${year}.pdf` }],
          },
        ],
      },
    ];
    const [block] = projectDocumentsComparisonWithSlots(app(fs("FY2023")), app(fs("FY2024")));
    expect(block!.rows.map((r) => r.label)).toEqual([
      "Audited Financial Statement FY2024",
      "Audited Financial Statement FY2023",
    ]);
    const keys = block!.rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(block!.rowSlots).toEqual([
      { requirementSlotIndex: 0, remarkScopeKey: null },
      {
        requirementSlotIndex: null,
        remarkScopeKey: "supporting_documents:financial_docs:0:Audited_Financial_Statement_FY20",
      },
    ]);
  });

  it("an untitled slot whose file is replaced stays one changed row (file name is not its identity)", () => {
    const untitled = (fileName: string, s3Key: string): CategoryJson[] => [
      { name: "Legal Docs", documents: [{ files: [{ s3_key: s3Key, file_name: fileName }] }] },
    ];
    const [block] = projectDocumentsComparisonWithSlots(
      app(untitled("a.pdf", "k/a")),
      app(untitled("b.pdf", "k/b"))
    );
    expect(block!.rows).toHaveLength(1);
    const row = block!.rows[0]!;
    expect(comparisonRowDiffers(row)).toBe(true);
    expect(row).toMatchObject({
      kind: "files",
      before: [{ s3Key: "k/a", fileName: "a.pdf" }],
      after: [{ s3Key: "k/b", fileName: "b.pdf" }],
    });
    expect(block!.rowSlots).toEqual([
      { requirementSlotIndex: 0, remarkScopeKey: "supporting_documents:legal_docs:0:a_pdf" },
    ]);
  });

  it("reordered identical slots do not differ", () => {
    const after = base();
    after[0]!.documents.push({ title: "Directors IC", files: [{ s3_key: "k/ic", file_name: "ic.pdf" }] });
    const before = base();
    before[0]!.documents.unshift({ title: "Directors IC", files: [{ s3_key: "k/ic", file_name: "ic.pdf" }] });
    expect(rows(app(before), app(after)).some(comparisonRowDiffers)).toBe(false);
    expect(documentsComparisonHasChanges(app(before), app(after))).toBe(false);
  });

  it("empty snapshots produce no blocks", () => {
    expect(projectDocumentsComparison({}, {})).toEqual([]);
  });
});

describe("amendmentRemarksForDocumentRow", () => {
  const remarks = [
    { scope: "item", scope_key: "supporting_documents:legal_docs:0:SSM_Profile", remark: "Re-upload SSM" },
    { scope: "section", scope_key: "supporting_documents", remark: "Section remark" },
    { scope: "item", scope_key: "supporting_documents:financial_docs:0:Bank", remark: "Other category" },
  ];

  it("matches the before slot by category + index (title slug may change)", () => {
    expect(
      amendmentRemarksForDocumentRow(remarks, "supporting_documents:legal_docs:0:SSM_Profile_v2")
    ).toEqual([{ remark: "Re-upload SSM" }]);
  });

  it("after-only rows (no before slot) get no remarks even when their after index matches", () => {
    const after = base();
    after[0]!.documents = [
      { title: "Directors IC", files: [{ s3_key: "k/ic", file_name: "ic.pdf" }] },
      ...after[0]!.documents,
    ];
    const before = base();
    before[0]!.documents = [{ title: "Board Resolution", files: [{ s3_key: "k/br", file_name: "br.pdf" }] }];
    const legal = projectDocumentsComparisonWithSlots(app(before), app(after)).find(
      (b) => b.id === "legal_docs"
    )!;
    const notes = legal.rows.map((row, i) => [
      row.label,
      amendmentRemarksForDocumentRow(
        [{ scope: "item", scope_key: "supporting_documents:legal_docs:0:Board_Resolution", remark: "Fix BR" }],
        legal.rowSlots[i]!.remarkScopeKey
      ),
    ]);
    expect(notes).toEqual([
      ["Directors IC", []],
      ["SSM Profile", []],
      ["Board Resolution", [{ remark: "Fix BR" }]],
    ]);
  });

  it("returns nothing without remarks", () => {
    expect(amendmentRemarksForDocumentRow(undefined, "supporting_documents:legal_docs:0:x")).toEqual([]);
  });
});
