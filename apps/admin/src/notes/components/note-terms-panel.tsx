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

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getRiskRating(note: NoteDetail) {
  const offerDetails = asRecord(note.invoiceSnapshot?.offer_details);
  const riskRating = offerDetails?.risk_rating;
  return isSoukscoreRiskRating(riskRating) ? riskRating : "—";
}

function getFacilityFeeDisplay(note: NoteDetail): string | null {
  const disbursement = note.withdrawals?.find(
    (withdrawal) => withdrawal.withdrawalType === "ISSUER_DISBURSEMENT"
  );
  const chargedAmount = numberOrNull(disbursement?.facilityFeeCharged);
  if (chargedAmount != null && chargedAmount > 0) {
    // Commercial Terms are a terms summary. Use "at disbursement" wording.
    return `${formatCurrency(chargedAmount)} at disbursement`;
  }

  const contract = asRecord(note.contractSnapshot);
  const contractDetails = asRecord(contract?.contract_details);
  const rate = numberOrNull(contractDetails?.facility_fee_rate_percent);
  if (rate == null || rate <= 0) return null;

  const approvedFacility = numberOrNull(contractDetails?.approved_facility);
  const paidAmount = numberOrNull(contractDetails?.facility_fee_paid_amount) ?? 0;
  const cap = approvedFacility != null ? approvedFacility * (rate / 100) : null;
  const remainingCap = cap != null ? Math.max(0, cap - paidAmount) : null;
  const baseAmount = numberOrNull(note.fundedAmount) ?? numberOrNull(note.targetAmount);
  if (baseAmount == null || baseAmount <= 0) return null;

  const rawFee = baseAmount * (rate / 100);
  const estimatedFee = remainingCap != null ? Math.min(rawFee, remainingCap) : rawFee;
  if (estimatedFee <= 0) return null;
  // Keep terms wording consistent with the "at disbursement" style.
  return `${formatCurrency(estimatedFee)} at disbursement`;
}

function getFundingProgressClass(note: NoteDetail) {
  if (note.status === "REPAID") {
    return "bg-muted [&>div]:bg-emerald-500";
  }
  if (note.fundingStatus === "FUNDED" || note.fundingStatus === "FAILED") {
    return "bg-muted [&>div]:bg-black";
  }
  return "[&>div]:bg-primary";
}

export function NoteTermsPanel({ note }: { note: NoteDetail }) {
  const invoiceAmount = getInvoiceAmount(note);
  const riskRating = getRiskRating(note);
  const progressValue = Math.min(Math.max(note.fundingPercent, 0), 100);
  const progressClassName = getFundingProgressClass(note);
  const facilityFeeDisplay = getFacilityFeeDisplay(note);
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
          <Row
            label="Profit rate"
            value={note.profitRatePercent == null ? "—" : `${note.profitRatePercent}% p.a.`}
          />
          <Row label="Platform fee" value={`${note.platformFeeRatePercent}% at disbursement`} />
          {facilityFeeDisplay ? <Row label="Facility fee" value={facilityFeeDisplay} /> : null}
          <Row label="Service fee" value={`${note.serviceFeeRatePercent}% of investor profit`} />
          <Row
            label="Late caps"
            value={`Ta'widh ${note.tawidhRateCapPercent}%, Gharamah ${note.gharamahRateCapPercent}%`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
