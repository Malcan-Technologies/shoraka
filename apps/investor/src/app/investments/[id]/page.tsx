"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency, useOrganization } from "@cashsouk/config";
import { useHeader, Card, CardContent, CardHeader, CardTitle, Badge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCommitInvestment, useMarketplaceNote } from "@/investments/hooks/use-marketplace-notes";

export default function InvestmentDetailPage() {
  const params = useParams<{ id: string }>();
  const noteId = params.id;
  const { setTitle } = useHeader();
  const { activeOrganization } = useOrganization();
  const { data: note, isLoading, error } = useMarketplaceNote(noteId);
  const commitInvestment = useCommitInvestment(noteId);
  const [amount, setAmount] = React.useState("");

  React.useEffect(() => {
    setTitle("Investment Detail");
  }, [setTitle]);

  const handleCommit = async () => {
    const parsed = Number(amount);
    if (!activeOrganization?.id) {
      toast.error("Select an investor organization first");
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid investment amount");
      return;
    }
    try {
      await commitInvestment.mutateAsync({
        amount: parsed,
        investorOrganizationId: activeOrganization.id,
      });
      setAmount("");
      toast.success("Investment committed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to commit investment");
    }
  };

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading note...</div>;
  }

  if (error || !note) {
    return (
      <div className="p-4 text-destructive">
        {error instanceof Error ? error.message : "Note not found"}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{note.title}</h1>
            <p className="mt-1 text-muted-foreground">{note.noteReference}</p>
          </div>
          <Badge variant="outline">{note.fundingStatus.replace(/_/g, " ")}</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Target</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{formatCurrency(note.targetAmount)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Funded</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{note.fundingPercent.toFixed(1)}%</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Profit Rate</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{note.profitRatePercent ?? 0}%</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Commit Investment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Commit funds from your investor pool. Your allocation is calculated from your confirmed funding ratio.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Amount in RM"
                inputMode="decimal"
              />
              <Button onClick={handleCommit} disabled={commitInvestment.isPending}>
                {commitInvestment.isPending ? "Committing..." : "Commit"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

