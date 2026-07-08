/**
 * Documents × recipients signing matrix with per-cell status and an overall progress bar.
 * Read-only; used in the issuer offer review modal when a package has been sent.
 */
"use client";

import * as React from "react";
import { Progress } from "@cashsouk/ui";
import {
  computeSigningEnvelopeProgress,
  type SigningAssignmentStatus,
  type SigningEnvelopeDto,
} from "@cashsouk/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const CELL: Record<SigningAssignmentStatus, { label: string; symbol: string; className: string }> = {
  PENDING: { label: "Pending", symbol: "○", className: "text-muted-foreground" },
  SENT: { label: "Sent", symbol: "◔", className: "text-amber-600" },
  VIEWED: { label: "Viewed", symbol: "◑", className: "text-amber-600" },
  SIGNED: { label: "Signed", symbol: "●", className: "text-emerald-600" },
  DECLINED: { label: "Declined", symbol: "✕", className: "text-primary" },
};

export function SigningProgressMatrix({ envelope }: { envelope: SigningEnvelopeDto }) {
  const progress = React.useMemo(() => computeSigningEnvelopeProgress(envelope), [envelope]);
  const assignmentByCell = React.useMemo(() => {
    const map = new Map<string, SigningAssignmentStatus>();
    for (const a of envelope.assignments) {
      map.set(`${a.document_id}:${a.recipient_id}`, a.status);
    }
    return map;
  }, [envelope.assignments]);

  if (envelope.documents.length === 0 || envelope.recipients.length === 0) {
    return <p className="text-sm text-muted-foreground">No documents or recipients yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Progress value={progress.percent} className="h-2 flex-1" />
        <span className="text-sm font-medium tabular-nums">
          {progress.signed}/{progress.total_required} signed ({progress.percent}%)
        </span>
      </div>

      <TooltipProvider>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[12rem]">Document</TableHead>
                {envelope.recipients.map((r) => (
                  <TableHead key={r.id} className="text-center">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs font-normal text-muted-foreground">{r.role_label}</div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {envelope.documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.name}</TableCell>
                  {envelope.recipients.map((r) => {
                    const status = assignmentByCell.get(`${doc.id}:${r.id}`);
                    if (!status) {
                      return (
                        <TableCell key={r.id} className="text-center text-muted-foreground/40">
                          –
                        </TableCell>
                      );
                    }
                    const cell = CELL[status];
                    return (
                      <TableCell key={r.id} className="text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`text-lg ${cell.className}`} aria-label={cell.label}>
                              {cell.symbol}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{cell.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </TooltipProvider>
    </div>
  );
}
