/**
 * Hook that returns applications for the dashboard.
 * Uses USE_MOCK_DATA: if true, returns mock data; if false, fetches from API.
 * Data is always normalized and sorted.
 */

import { useMemo } from "react";
import { useOrganization } from "@cashsouk/config";
import { useOrganizationApplications } from "@/hooks/use-applications";
import {
  USE_MOCK_DATA,
  mockApplications,
} from "./data";
import { normalizeApplication } from "./adapters/application.adapter";
import { STATUS_PRIORITY } from "./applications.config";
import type { NormalizedApplication } from "./adapters/application.adapter";

/* ============================================================
   Sort applications by status priority, then updated_at
   ============================================================ */

function sortApplications(apps: NormalizedApplication[]): NormalizedApplication[] {
  return [...apps].sort((a, b) => {
    const prioA = STATUS_PRIORITY[a.status] ?? 999;
    const prioB = STATUS_PRIORITY[b.status] ?? 999;
    if (prioA !== prioB) return prioA - prioB;
    const dateA = new Date(a.updatedAt).getTime();
    const dateB = new Date(b.updatedAt).getTime();
    return dateB - dateA;
  });
}

/* ============================================================
   useApplicationsData — single source of truth for dashboard
   ============================================================ */

export function useApplicationsData(): {
  applications: NormalizedApplication[];
  isLoading: boolean;
  error: Error | null;
} {
  const { activeOrganization } = useOrganization();
  const { data: apiApplications = [], isLoading, error } = useOrganizationApplications(
    USE_MOCK_DATA ? undefined : activeOrganization?.id
  );

  const applications = useMemo(() => {
    if (USE_MOCK_DATA) {
      return sortApplications(mockApplications);
    }
    const normalized = (apiApplications as any[]).map((app) =>
      normalizeApplication(app)
    );
    return sortApplications(normalized);
  }, [USE_MOCK_DATA, apiApplications]);

  return {
    applications,
    isLoading: USE_MOCK_DATA ? false : isLoading,
    error: error ?? null,
  };
}
