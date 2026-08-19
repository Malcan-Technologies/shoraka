export const PORTFOLIO_PATH = "/investments";
export const PORTFOLIO_TAB_INVESTMENTS = "investments";
export const PORTFOLIO_TAB_TRANSACTIONS = "transactions";

export type PortfolioTab =
  | typeof PORTFOLIO_TAB_INVESTMENTS
  | typeof PORTFOLIO_TAB_TRANSACTIONS;

export const PORTFOLIO_TRANSACTIONS_HREF = `${PORTFOLIO_PATH}?tab=${PORTFOLIO_TAB_TRANSACTIONS}`;

export function isPortfolioTab(value: string | null | undefined): value is PortfolioTab {
  return value === PORTFOLIO_TAB_INVESTMENTS || value === PORTFOLIO_TAB_TRANSACTIONS;
}

export function portfolioTabFromSearchParams(
  tab: string | null,
  type: string | null
): PortfolioTab {
  if (isPortfolioTab(tab)) return tab;
  if (type) return PORTFOLIO_TAB_TRANSACTIONS;
  return PORTFOLIO_TAB_INVESTMENTS;
}

export function isPortfolioNavActive(pathname: string): boolean {
  return (
    pathname === PORTFOLIO_PATH ||
    pathname.startsWith(`${PORTFOLIO_PATH}/`) ||
    pathname === "/transactions"
  );
}

export function buildPortfolioHref(options: {
  tab?: PortfolioTab;
  type?: string | null;
}): string {
  const params = new URLSearchParams();
  const tab = options.tab ?? PORTFOLIO_TAB_INVESTMENTS;
  if (tab !== PORTFOLIO_TAB_INVESTMENTS) {
    params.set("tab", tab);
  }
  if (tab === PORTFOLIO_TAB_TRANSACTIONS && options.type) {
    params.set("type", options.type);
  }
  const query = params.toString();
  return query ? `${PORTFOLIO_PATH}?${query}` : PORTFOLIO_PATH;
}

export function buildTransactionsRedirectHref(
  search: Record<string, string | string[] | undefined>
): string {
  const params = new URLSearchParams();
  params.set("tab", PORTFOLIO_TAB_TRANSACTIONS);
  for (const [key, raw] of Object.entries(search)) {
    if (key === "tab") continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value) params.set(key, value);
  }
  return `${PORTFOLIO_PATH}?${params.toString()}`;
}
