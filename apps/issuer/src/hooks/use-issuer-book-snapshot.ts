import { useMemo } from "react";
import { useApplicationsData } from "@/app/(application-management)/applications/use-applications-data";
import { useIssuerDashboard } from "@/hooks/use-issuer-dashboard";
import { useIssuerNotes } from "@/notes/hooks/use-issuer-notes";
import { buildIssuerBookSnapshot } from "@/lib/issuer-book-snapshot";

export type IssuerFinancingOverviewStats = {
  successRatePercent: number | null;
  activeFinancingAmount: number | null;
  pastFinancingAmount: number | null;
  completedNotesCount: number | null;
};

function parseOverviewAmount(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = value.trim().replace(/^RM\s*/i, "").replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function useIssuerBookSnapshot(organizationId: string | undefined) {
  const { applications, isLoading: isApplicationsLoading } = useApplicationsData();
  const { data: dashboard, isLoading: isDashboardLoading } = useIssuerDashboard(organizationId);
  const { data: notesData, isLoading: isNotesLoading } = useIssuerNotes();

  const snapshot = useMemo(
    () =>
      buildIssuerBookSnapshot({
        applications,
        contracts: dashboard?.contracts ?? [],
        invoices: dashboard?.invoices ?? [],
        notes: notesData?.notes ?? [],
      }),
    [applications, dashboard?.contracts, dashboard?.invoices, notesData?.notes]
  );

  const overview = useMemo<IssuerFinancingOverviewStats>(() => {
    const o = dashboard?.overview;
    return {
      successRatePercent:
        o?.successRatePercent != null && Number.isFinite(o.successRatePercent)
          ? o.successRatePercent
          : null,
      activeFinancingAmount: parseOverviewAmount(o?.activeFinancingAmount),
      pastFinancingAmount: parseOverviewAmount(o?.pastFinancingAmount),
      completedNotesCount:
        o?.completedNotesCount != null && Number.isFinite(o.completedNotesCount)
          ? o.completedNotesCount
          : null,
    };
  }, [dashboard?.overview]);

  return {
    snapshot,
    overview,
    isLoading: isApplicationsLoading || isDashboardLoading || isNotesLoading,
  };
}
