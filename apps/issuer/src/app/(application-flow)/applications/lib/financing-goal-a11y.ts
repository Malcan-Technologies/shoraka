export function goalRadioTabIndex(options: { isTabStop: boolean; disabled: boolean }): number {
  if (options.disabled || !options.isTabStop) return -1;
  return 0;
}

export function resolveGoalRadioTabStopId<T extends string>(
  selectedId: T,
  enabledIds: readonly T[]
): T | undefined {
  if (enabledIds.includes(selectedId)) return selectedId;
  return enabledIds[0];
}
