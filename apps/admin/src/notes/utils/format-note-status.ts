export function formatNoteStatus(value: string | null | undefined) {
  if (!value) return "-";
  const label = value.replace(/_/g, " ").toLowerCase();
  return label.charAt(0).toUpperCase() + label.slice(1);
}
