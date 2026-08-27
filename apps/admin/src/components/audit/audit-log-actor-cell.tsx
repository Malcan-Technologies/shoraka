"use client";

import { TableCell } from "@/components/ui/table";
import { presentAuditActorName } from "./audit-presentation";

export function AuditLogActorCell({
  name,
  email,
  actorType,
}: {
  name?: string | null;
  email?: string | null;
  actorType?: string | null;
}) {
  const displayName = presentAuditActorName(name, actorType);
  return (
    <TableCell className="min-w-[180px] max-w-[280px]">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-ui font-medium" title={displayName}>
          {displayName}
        </span>
        {email ? (
          <span className="truncate text-meta text-muted-foreground" title={email}>
            {email}
          </span>
        ) : null}
      </div>
    </TableCell>
  );
}
