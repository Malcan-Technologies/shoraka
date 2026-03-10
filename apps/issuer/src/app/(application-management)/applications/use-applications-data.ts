/**
 * Returns applications for the dashboard. When USE_MOCK_DATA is true, uses mock data; otherwise fetches from the API.
 * Data is always normalized and sorted by status priority, then updated_at.
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
   SORT HELPER
   ============================================================
   Sorts by status priority first, then by updated_at (newer first). */

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
   useApplicationsData
   ============================================================
   Single source of truth for dashboard applications. Branches on USE_MOCK_DATA. */

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
