import Link from "next/link";
import { formatCurrency } from "@cashsouk/config";
import type { NoteListItem } from "@cashsouk/types";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";

export function NoteCard({ note }: { note: NoteListItem }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{note.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{note.issuerName ?? "Issuer"}</p>
          </div>
          <Badge variant="outline">{note.status.replace(/_/g, " ")}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Target</div>
            <div className="font-semibold">{formatCurrency(note.targetAmount)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Profit rate</div>
            <div className="font-semibold">{note.profitRatePercent ?? 0}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Funded</div>
            <div className="font-semibold">{note.fundingPercent.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Maturity</div>
            <div className="font-semibold">
              {note.maturityDate ? new Date(note.maturityDate).toLocaleDateString("en-MY") : "—"}
            </div>
          </div>
        </div>
        <Button asChild className="w-full">
          <Link href={`/investments/${note.id}`}>View Note</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

