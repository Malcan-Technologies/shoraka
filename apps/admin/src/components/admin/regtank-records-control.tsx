"use client";

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import {
  getRegtankColumnDisplayRows,
  type ApplicationPersonRow,
  type RegtankColumnDisplayRow,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function RegtankPopoverRecord({ row }: { row: RegtankColumnDisplayRow }) {
  return (
    <div className="min-w-0">
      <div className="text-meta leading-4 text-muted-foreground">{row.groupLabel}</div>
      {row.url ? (
        <a
          href={row.url}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${row.groupLabel} ${row.requestId} in RegTank`}
          className="mt-0.5 inline-flex max-w-full items-center gap-1 font-mono text-meta leading-4 text-foreground hover:text-primary hover:underline"
        >
          <span className="truncate">{row.requestId}</span>
          <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        </a>
      ) : (
        <div className="mt-0.5 truncate font-mono text-meta leading-4">{row.requestId}</div>
      )}
    </div>
  );
}

export function RegtankRecordsControl({ person }: { person: ApplicationPersonRow }) {
  const rows = getRegtankColumnDisplayRows(person);
  if (rows.length === 0) {
    return <span className="text-ui text-muted-foreground">—</span>;
  }
  const count = rows.length;
  const recordLabel = count === 1 ? "1 record" : `${count} records`;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-meta text-muted-foreground">{recordLabel}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`View ${recordLabel} in RegTank`}
          >
            View
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[16.5rem] p-3" align="start" side="bottom" sideOffset={6}>
          <div className="text-ui font-medium">RegTank records</div>
          <div className="mt-2 space-y-2">
            {rows.map((row) => (
              <RegtankPopoverRecord key={`${row.kind}-${row.groupLabel}-${row.requestId}`} row={row} />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
