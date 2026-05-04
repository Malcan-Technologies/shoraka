"use client";

import * as React from "react";
import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import { useHeader, Card, CardContent, CardHeader, CardTitle, Badge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { useIssuerNotes } from "@/notes/hooks/use-issuer-notes";

export default function IssuerNotesPage() {
  const { setTitle } = useHeader();
  const { data, isLoading, error } = useIssuerNotes();

  React.useEffect(() => {
    setTitle("Notes");
  }, [setTitle]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-x-hidden p-4 pt-4">
      <div className="min-w-0 max-w-full space-y-6 p-2 md:p-4">
        <div>
          <h1 className="text-2xl font-semibold">My Notes</h1>
          <p className="mt-1 text-muted-foreground">
            Track note funding, disbursement, repayment status, and payment instructions.
          </p>
        </div>
        {error && (
          <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load notes"}
          </div>
        )}
        {isLoading ? (
          <div className="text-muted-foreground">Loading notes...</div>
        ) : data?.notes.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.notes.map((note) => (
              <Card key={note.id} className="rounded-2xl">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg">{note.title}</CardTitle>
                    <Badge variant="outline">{note.status.replace(/_/g, " ")}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Risk rating</div>
                    <div className="mt-1 text-4xl font-semibold leading-none text-foreground">{note.riskRating ?? "-"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">SoukScore grade for this invoice note</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-muted-foreground">Target</div>
                      <div className="font-semibold">{formatCurrency(note.targetAmount)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Funded</div>
                      <div className="font-semibold">{note.fundingPercent.toFixed(1)}%</div>
                    </div>
                  </div>
                  {note.settlementSummary ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">Settled</span>
                        <Badge variant="secondary">{formatCurrency(note.settlementSummary.grossReceiptAmount)}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-emerald-800">Repayment Pool</div>
                          <div className="font-semibold">{formatCurrency(note.settlementSummary.grossReceiptAmount)}</div>
                        </div>
                        <div>
                          <div className="text-emerald-800">Investor Pool</div>
                          <div className="font-semibold">{formatCurrency(note.settlementSummary.investorPoolAmount)}</div>
                        </div>
                        <div>
                          <div className="text-emerald-800">Operating</div>
                          <div className="font-semibold">{formatCurrency(note.settlementSummary.operatingAccountAmount)}</div>
                        </div>
                        <div>
                          <div className="text-emerald-800">{"Ta'widh"}</div>
                          <div className="font-semibold">{formatCurrency(note.settlementSummary.tawidhAccountAmount)}</div>
                        </div>
                        <div>
                          <div className="text-emerald-800">Gharamah</div>
                          <div className="font-semibold">{formatCurrency(note.settlementSummary.gharamahAccountAmount)}</div>
                        </div>
                      </div>
                      <div className="mt-2 text-xs">
                        Issuer residual: {formatCurrency(note.settlementSummary.issuerResidualAmount)}
                      </div>
                    </div>
                  ) : null}
                  <Button asChild className="w-full">
                    <Link href={`/notes/${note.id}`}>View Note</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            No notes are available yet.
          </div>
        )}
      </div>
    </div>
  );
}

