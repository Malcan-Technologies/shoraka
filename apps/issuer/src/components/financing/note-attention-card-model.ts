import { formatCurrency } from "@cashsouk/config";
import type { NoteListItem } from "@cashsouk/types";
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
      hint: `${formatCurrency(outstanding)} in late payment charges is due on note ${note.noteReference || note.id}.`,
    };
  }
  const status = String(note.status ?? "").toUpperCase();
  const servicing = String(note.servicingStatus ?? "").toUpperCase();
  if (status === "ARREARS" || servicing === "ARREARS") {
    return {
      headline: "Repayment is in arrears",
      label: "Report repayment",
      hint: "Arrange payment with your customer and upload proof.",
    };
  }
  return {
    headline: "Repayment is overdue",
    label: "View details",
    hint: null,
  };
}
