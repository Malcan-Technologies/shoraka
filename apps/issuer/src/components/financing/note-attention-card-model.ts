import type { NoteListItem } from "@cashsouk/types";

export type NoteAttentionAction = {
  headline: string;
  label: string;
  hint: string | null;
};

export function getNoteAttentionAction(note: NoteListItem): NoteAttentionAction {
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
