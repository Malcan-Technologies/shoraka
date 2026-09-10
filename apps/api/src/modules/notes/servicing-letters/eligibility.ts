export function canIssueDefaultNotice(note: {
  default_marked_at: Date | null;
}): boolean {
  return note.default_marked_at != null;
}
