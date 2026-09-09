import { formatCurrency } from "@cashsouk/config";
import { formatNoteReference, type NoteListItem } from "@cashsouk/types";
import { outstandingExcessLateCharges } from "@/lib/issuer-financing-actionable";

export type NoteAttentionAction = {
  headline: string;
  label: string;
  hint: string | null;
};

export function getNoteAttentionAction(note: NoteListItem): NoteAttentionAction {
  const outstanding = outstandingExcessLateCharges(note);
  if (outstanding > 0) {
    return {
      headline: "Pay outstanding late charges",
      label: "Pay late charges",
      hint: `${formatCurrency(outstanding)} in late payment charges is due on note ${formatNoteReference({
        noteReference: note.noteReference,
        id: note.id,
      })}.`,
    };
  }
  const status = String(note.status ?? "").toUpperCase();
  const servicing = String(note.servicingStatus ?? "").toUpperCase();
  const dpd = Number(note.daysPastDue ?? 0);
  const dpdHint =
    Number.isFinite(dpd) && dpd > 0
      ? `${dpd} day${dpd === 1 ? "" : "s"} past due.`
      : null;
  if (status === "DEFAULTED" || servicing === "DEFAULTED") {
    return {
      headline: "Note is in default",
      label: "View details",
      hint: dpdHint,
    };
  }
  if (status === "ARREARS" || servicing === "ARREARS") {
    return {
      headline: "Repayment is in arrears",
      label: "Report repayment",
      hint: dpdHint ?? "Arrange payment with your customer and upload proof.",
    };
  }
  if (servicing === "LATE") {
    return {
      headline: "Repayment is late",
      label: "View details",
      hint: dpdHint,
    };
  }
  return {
    headline: "Repayment is overdue",
    label: "View details",
    hint: dpdHint,
  };
}
