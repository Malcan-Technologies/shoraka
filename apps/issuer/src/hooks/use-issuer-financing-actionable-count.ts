"use client";

import { useMemo } from "react";
import { useIssuerDashboard } from "@/hooks/use-issuer-dashboard";
import { useIssuerNotes } from "@/notes/hooks/use-issuer-notes";
import { countIssuerFinancingActionable } from "@/lib/issuer-financing-actionable";

export {
  isIssuerContractActionable,
  isIssuerInvoiceActionable,
  isIssuerNoteActionable,
  partitionByActionable,
} from "@/lib/issuer-financing-actionable";

/** Sidebar / tab badge: contracts + invoices (including notes on the invoices tab) that still need issuer action. */
export function useIssuerFinancingActionableCount(organizationId: string | undefined): {
  contracts: number;
  invoices: number;
  notes: number;
  total: number;
} {
  const { data } = useIssuerDashboard(organizationId);
  const { data: notesData } = useIssuerNotes();

  return useMemo(() => {
    return countIssuerFinancingActionable({
      contracts: data?.contracts ?? [],
      invoices: data?.invoices ?? [],
      notes: notesData?.notes ?? [],
    });
  }, [data, notesData]);
}
