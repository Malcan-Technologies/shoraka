import type { GetAdminNotesParams } from "@cashsouk/types";

export const notesKeys = {
  all: ["notes"] as const,
  lists: () => [...notesKeys.all, "list"] as const,
  list: (params: GetAdminNotesParams) => [...notesKeys.lists(), params] as const,
  details: () => [...notesKeys.all, "detail"] as const,
  detail: (id?: string) => [...notesKeys.details(), id] as const,
};

