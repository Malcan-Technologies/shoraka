import { NoteStatus } from "@cashsouk/types";
import { ListToolbar } from "@/shared/admin-list/components/list-toolbar";
import { formatNoteStatus } from "@/notes/utils/format-note-status";

interface NotesTableToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onClearFilters: () => void;
  onReload: () => void;
  totalCount: number;
  isLoading: boolean;
  featuredOnly: boolean;
  onFeaturedOnlyChange: (value: boolean) => void;
}

export function NotesTableToolbar({
  searchQuery,
  onSearchChange,
  status,
  onStatusChange,
  onClearFilters,
  onReload,
  totalCount,
  isLoading,
  featuredOnly,
  onFeaturedOnlyChange,
}: NotesTableToolbarProps) {
  const statusFilters = status === "ALL" ? [] : [status];

  const handleStatusFiltersChange = (values: string[]) => {
    onStatusChange(values[0] ?? "ALL");
  };

  return (
    <ListToolbar
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search notes, reference, application, issuer, or paymaster"
      statusFilters={statusFilters}
      onStatusFiltersChange={handleStatusFiltersChange}
      statusOptions={Object.values(NoteStatus).map((value) => ({
        value,
        label: formatNoteStatus(value),
      }))}
      statusFilterMode="single"
      totalCount={totalCount}
      filteredCount={totalCount}
      itemLabelSingular="note"
      itemLabelPlural="notes"
      onClearFilters={onClearFilters}
      onReload={onReload}
      isLoading={isLoading}
      extraToggleLabel="Featured only"
      extraToggleChecked={featuredOnly}
      onExtraToggleChange={onFeaturedOnlyChange}
    />
  );
}

