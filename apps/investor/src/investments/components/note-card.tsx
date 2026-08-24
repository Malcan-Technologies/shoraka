import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import {
  formatInvestorReturnRatePercent,
  formatIssuerFinancingTenure,
  formatIssuerNoteMaturity,
  resolveNoteTimingDisplay,
  shouldLabelExpectedReturnAsUpTo,
  type NoteListItem,
} from "@cashsouk/types";
import { NoteStatusBadge, Card, CardContent, CardHeader, CardTitle } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";

export function NoteCard({ note }: { note: NoteListItem }) {
  const timing = resolveNoteTimingDisplay(note);
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{note.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {note.purposeOfFinancing?.trim() || note.title}
            </p>
          </div>
          <NoteStatusBadge note={note} className="shrink-0" viewer="investor" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Target</div>
            <div className="font-semibold">{formatCurrency(note.targetAmount)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">
              {shouldLabelExpectedReturnAsUpTo({ tenureDays: note.tenureDays })
                ? "Up to"
                : "Profit rate"}
            </div>
            <div className="font-semibold">
              {formatInvestorReturnRatePercent(note.profitRatePercent)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Funded</div>
            <div className="font-semibold">{note.fundingPercent.toFixed(1)}%</div>
          </div>
          {timing.isTenureNote ? (
            <div>
              <div className="text-muted-foreground">Financing tenure</div>
              <div className="font-semibold">{formatIssuerFinancingTenure(timing)}</div>
            </div>
          ) : null}
          <div>
            <div className="text-muted-foreground">
              {timing.isTenureNote ? "Maturity date" : timing.label}
            </div>
            <div className="font-semibold">{formatIssuerNoteMaturity(timing)}</div>
          </div>
        </div>
        <Button asChild className="w-full">
          <Link href={`/investments/${note.id}`}>View Note</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

