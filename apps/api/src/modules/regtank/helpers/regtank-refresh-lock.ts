const inFlight = new Map<string, Promise<unknown>>();

export const REFRESH_IN_PROGRESS_CODE = "REFRESH_IN_PROGRESS";
export const REFRESH_IN_PROGRESS_MESSAGE = "Refresh already in progress.";

/**
 * In-process single-flight for manual admin refresh.
 * Protects one Node process only — two ECS tasks can still overlap.
 */
export async function runExclusiveOnboardingRefresh<T>(
  organizationId: string,
  run: () => Promise<T>
): Promise<T | "IN_PROGRESS"> {
  if (inFlight.has(organizationId)) {
    return "IN_PROGRESS";
  }
  const pending = run();
  inFlight.set(organizationId, pending);
  try {
    return await pending;
  } finally {
    if (inFlight.get(organizationId) === pending) {
      inFlight.delete(organizationId);
    }
  }
}

export function resetOnboardingRefreshLockForTests(): void {
  inFlight.clear();
}
