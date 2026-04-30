import { formatCurrency } from "@cashsouk/config";
import { isSoukscoreRiskRating, type NoteDetail } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@cashsouk/ui";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function getInvoiceAmount(note: NoteDetail) {
  const extended = note as NoteDetail & { invoiceAmount?: number; settlementAmount?: number };
  return extended.invoiceAmount ?? extended.settlementAmount ?? note.requestedAmount;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getRiskRating(note: NoteDetail) {
  const offerDetails = asRecord(note.invoiceSnapshot?.offer_details);
  const riskRating = offerDetails?.risk_rating;
  return isSoukscoreRiskRating(riskRating) ? riskRating : "—";
}

function getFundingProgressClass(fundingStatus: NoteDetail["fundingStatus"]) {
  if (fundingStatus === "FUNDED" || fundingStatus === "FAILED") {
    return "bg-muted [&>div]:bg-black";
  }
  return "[&>div]:bg-primary";
}

export function NoteTermsPanel({ note }: { note: NoteDetail }) {
  const invoiceAmount = getInvoiceAmount(note);
  const riskRating = getRiskRating(note);
  const progressValue = Math.min(Math.max(note.fundingPercent, 0), 100);
  const progressClassName = getFundingProgressClass(note.fundingStatus);
  const isFundingOpen = note.fundingStatus === "OPEN";
  const isFundingClosed = note.fundingStatus === "CLOSED" || note.fundingStatus === "FUNDED";
  const fundingStatusLabel = isFundingOpen
    ? "Still Funding"
    : isFundingClosed
      ? "Funding Closed"
      : note.fundingStatus.replace(/_/g, " ");

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Commercial Terms</CardTitle>
          <Badge variant={isFundingOpen ? "secondary" : "outline"}>{fundingStatusLabel}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Funded Amount</div>
              <div className="mt-1 text-2xl font-semibold">{formatCurrency(note.fundedAmount)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                of {formatCurrency(note.targetAmount)} target
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Funding Progress</div>
              <div className="mt-1 text-2xl font-semibold">{note.fundingPercent.toFixed(1)}%</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Minimum {note.minimumFundingPercent.toFixed(1)}%
              </div>
            </div>
          </div>
          <Progress value={progressValue} className={`mt-4 h-3 ${progressClassName}`} />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>{fundingStatusLabel}</span>
            <span>100%</span>
          </div>
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-2">
          <Row label="Invoice amount" value={formatCurrency(invoiceAmount)} />
          <Row label="Target amount" value={formatCurrency(note.targetAmount)} />
          <Row label="Risk rating" value={riskRating} />
          <Row label="Profit rate" value={note.profitRatePercent == null ? "—" : `${note.profitRatePercent}%`} />
          <Row label="Platform fee" value={`${note.platformFeeRatePercent}% at disbursement`} />
          <Row label="Service fee" value={`${note.serviceFeeRatePercent}% of investor profit`} />
          <Row label="Late caps" value={`Ta'widh ${note.tawidhRateCapPercent}%, Gharamah ${note.gharamahRateCapPercent}%`} />
        </div>
      </CardContent>
    </Card>
  );
}

