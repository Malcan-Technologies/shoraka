/**
 * Data hook for Applications dashboard.
 *
 * Source: USE_MOCK_DATA ? data.ts : GET /v1/applications?organizationId=... (via useOrganizationApplications).
 * Each API app is normalized via application.adapter before use.
 * Returns sorted list (STATUS_PRIORITY, then updated_at desc).
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

/* Sort by STATUS_PRIORITY (from config), then updated_at descending. */

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

/* Single source for dashboard applications. */

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
    let list: NormalizedApplication[];
    if (USE_MOCK_DATA) {
      list = mockApplications;
    } else {
      const normalized = (apiApplications as any[]).map((app) =>
        normalizeApplication(app)
      );
      list = normalized;
    }
    /* Archived apps are hidden from the dashboard. */
    const visible = list.filter((a) => a.status !== "archived");
    return sortApplications(visible);
  }, [USE_MOCK_DATA, apiApplications]);

  return {
    applications,
    isLoading: USE_MOCK_DATA ? false : isLoading,
    error: error ?? null,
  };
}
