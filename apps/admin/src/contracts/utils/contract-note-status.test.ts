import fs from "node:fs";
import path from "node:path";
import type { AdminContractNoteSummary } from "@cashsouk/types";
import { resolveContractNoteStatusBadge } from "./contract-note-status";

function note(status: string): AdminContractNoteSummary {
  return {
    id: `note-${status}`,
    noteReference: "NOTE-0001",
    title: "Invoice 4471 financing",
    status,
    sourceApplicationId: "app-1",
    sourceInvoiceId: "inv-1",
    sourceInvoiceDisplayReference: null,
    targetAmount: 8000,
    fundedAmount: 0,
    invoiceFaceAmount: null,
  };
}

describe("resolveContractNoteStatusBadge", () => {
  it("humanises the raw note status for the label", () => {
    expect(resolveContractNoteStatusBadge(note("FAILED_FUNDING")).label).toBe("Failed funding");
    expect(resolveContractNoteStatusBadge(note("DRAFT")).label).toBe("Draft");
  });

  it("flags notes that CashSouk must move along", () => {
    expect(resolveContractNoteStatusBadge(note("FUNDING")).token).toBe("action");
  });

  it("shows waiting on others while the note is funding in the marketplace", () => {
    expect(resolveContractNoteStatusBadge(note("PUBLISHED")).token).toBe("submitted");
  });

  it("maps live and finished notes to their own tokens", () => {
    expect(resolveContractNoteStatusBadge(note("ACTIVE")).token).toBe("active");
    expect(resolveContractNoteStatusBadge(note("REPAID")).token).toBe("success");
    expect(resolveContractNoteStatusBadge(note("DRAFT")).token).toBe("neutral");
    expect(resolveContractNoteStatusBadge(note("FAILED_FUNDING")).token).toBe("rejected");
  });
});

describe("ContractNotesTable action row", () => {
  it("washes note rows that need admin attention using the resolved status token", () => {
    const tableSource = fs.readFileSync(
      path.join(__dirname, "../components/contract-notes-table.tsx"),
      "utf8"
    );
    expect(tableSource).toContain("adminActionRowClass(status.token)");
    expect(tableSource).toContain("odd:bg-muted/40 hover:bg-muted");
    expect(tableSource).toContain("cn(");
    expect(tableSource).toContain("formatCurrency(note.targetAmount)");
    expect(tableSource).toContain("Financing / allocation");
    expect(tableSource).toContain("invoiceFaceAmount");
  });
});
