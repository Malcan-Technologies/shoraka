const DISMISSED_STORAGE_PREFIX = "investor-deposit-return-dismissed:";

export function hrefWithoutDepositReturn(pathname: string, search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("depositReturn");
  params.delete("returnTo");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function dismissedStorageKey(depositId: string): string {
  return `${DISMISSED_STORAGE_PREFIX}${depositId}`;
}

export function markDepositReturnDismissed(depositId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(dismissedStorageKey(depositId), "1");
}

export function isDepositReturnDismissed(depositId: string): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(dismissedStorageKey(depositId)) === "1";
}
