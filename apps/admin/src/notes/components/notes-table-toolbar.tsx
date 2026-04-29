import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NoteStatus } from "@cashsouk/types";

interface NotesTableToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  onClearFilters: () => void;
  onReload: () => void;
  totalCount: number;
  isLoading: boolean;
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
}: NotesTableToolbarProps) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row">
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search notes, reference, or application"
            className="md:max-w-sm"
          />
          <Select value={status} onValueChange={onStatusChange}>
            <SelectTrigger className="md:w-[220px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {Object.values(NoteStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {value.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{totalCount} notes</span>
          <Button variant="outline" onClick={onClearFilters} disabled={isLoading}>
            Clear
          </Button>
          <Button variant="outline" onClick={onReload} disabled={isLoading}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  );
}

