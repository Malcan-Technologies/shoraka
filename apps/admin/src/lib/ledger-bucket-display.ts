import { NoteLedgerAccountType, type NoteLedgerBucketBalance } from "@cashsouk/types";

export type LedgerBucketGroupId = "custody" | "income" | "payable";

export interface LedgerBucketMeta {
  shortLabel: string;
  hint: string;
  detail: string;
  group: LedgerBucketGroupId;
}

export const LEDGER_BUCKET_ORDER: NoteLedgerAccountType[] = [
  NoteLedgerAccountType.INVESTOR_POOL,
  NoteLedgerAccountType.REPAYMENT_POOL,
  NoteLedgerAccountType.OPERATING_ACCOUNT,
  NoteLedgerAccountType.TAWIDH_ACCOUNT,
  NoteLedgerAccountType.GHARAMAH_ACCOUNT,
  NoteLedgerAccountType.ISSUER_PAYABLE,
];

export const LEDGER_BUCKET_META: Record<NoteLedgerAccountType, LedgerBucketMeta> = {
  [NoteLedgerAccountType.INVESTOR_POOL]: {
    shortLabel: "Investor Pool",
    hint: "Investor funds",
    detail: "Investor funds, disbursements, principal returns, and net profit allocations.",
    group: "custody",
  },
  [NoteLedgerAccountType.REPAYMENT_POOL]: {
    shortLabel: "Repayment Pool",
    hint: "Awaiting allocation",
    detail: "Receipts collected from paymasters or issuers before settlement allocation.",
    group: "custody",
  },
  [NoteLedgerAccountType.OPERATING_ACCOUNT]: {
    shortLabel: "Operating",
    hint: "Operating fees",
    detail: "Drawdown fees, facility fees, additional fees, service fees, and operating account allocations.",
    group: "income",
  },
  [NoteLedgerAccountType.TAWIDH_ACCOUNT]: {
    shortLabel: "Ta'widh",
    hint: "Compensation",
    detail: "Syariah compensation account for approved Ta'widh late charges.",
    group: "income",
  },
  [NoteLedgerAccountType.GHARAMAH_ACCOUNT]: {
    shortLabel: "Gharamah",
    hint: "Charity / penalty",
    detail: "Syariah charity/penalty account for approved Gharamah late charges.",
    group: "income",
  },
  [NoteLedgerAccountType.ISSUER_PAYABLE]: {
    shortLabel: "Issuer Payable",
    hint: "Owed to issuers",
    detail: "Residual amounts owed to issuers from posted settlements, pending trustee disbursement.",
    group: "payable",
  },
};

export const LEDGER_BUCKET_GROUPS: Array<{
  id: LedgerBucketGroupId;
  label: string;
  hint: string;
  fillClass: string;
  surfaceClass: string;
}> = [
  {
    id: "custody",
    label: "Held for others",
    hint: "Investor funds and receipts still in platform pools",
    fillClass: "bg-status-submitted-text",
    surfaceClass: "bg-status-submitted-bg",
  },
  {
    id: "income",
    label: "Platform income",
    hint: "Fees and Syariah accounts",
    fillClass: "bg-[hsl(163_88%_40%)] dark:bg-status-success-text",
    surfaceClass: "bg-[hsl(152_76%_97%)] dark:bg-status-success-bg",
  },
  {
    id: "payable",
    label: "Owed out",
    hint: "Residuals awaiting issuer payout",
    fillClass: "bg-status-active-text",
    surfaceClass: "bg-status-active-bg",
  },
];

export interface LedgerBucketOverviewItem extends NoteLedgerBucketBalance {
  meta: LedgerBucketMeta;
}

export interface LedgerBucketOverviewGroup {
  id: LedgerBucketGroupId;
  label: string;
  hint: string;
  fillClass: string;
  surfaceClass: string;
  balance: number;
  held: number;
  itemHeldTotal: number;
  items: LedgerBucketOverviewItem[];
}

export interface LedgerBucketOverview {
  items: LedgerBucketOverviewItem[];
  groups: LedgerBucketOverviewGroup[];
  heldTotal: number;
  netBalance: number;
}

function emptyBucket(code: NoteLedgerAccountType): NoteLedgerBucketBalance {
  return {
    accountCode: code,
    accountName: LEDGER_BUCKET_META[code].shortLabel,
    accountType: code,
    currency: "MYR",
    debitTotal: 0,
    creditTotal: 0,
    balance: 0,
    entryCount: 0,
    lastPostedAt: null,
  };
}

function heldAmount(balance: number) {
  return Math.max(balance, 0);
}

export function formatLedgerShare(part: number, total: number) {
  if (total <= 0 || part <= 0) return "0%";
  const pct = (part / total) * 100;
  if (pct < 1) return "<1%";
  return `${Math.round(pct)}%`;
}

function titleCaseSnake(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Human-readable ledger bucket name, e.g. REPAYMENT_POOL → "Repayment Pool". */
export function formatLedgerBucketLabel(code: string | null | undefined): string {
  if (!code?.trim()) return "Unknown account";
  const meta = LEDGER_BUCKET_META[code as NoteLedgerAccountType];
  if (meta) return meta.shortLabel;
  return titleCaseSnake(code);
}

export function ledgerBarWidthPercent(part: number, total: number) {
  if (total <= 0 || part <= 0) return 0;
  return (part / total) * 100;
}

export function buildLedgerBucketOverview(
  buckets: NoteLedgerBucketBalance[]
): LedgerBucketOverview {
  const byCode = new Map(buckets.map((bucket) => [bucket.accountCode, bucket]));
  const items = LEDGER_BUCKET_ORDER.map((code) => {
    const bucket = byCode.get(code) ?? emptyBucket(code);
    return { ...bucket, meta: LEDGER_BUCKET_META[code] };
  });

  const groups = LEDGER_BUCKET_GROUPS.map((group) => {
    const groupItems = items.filter((item) => item.meta.group === group.id);
    const balance = groupItems.reduce((sum, item) => sum + item.balance, 0);
    const itemHeldTotal = groupItems.reduce((sum, item) => sum + heldAmount(item.balance), 0);
    return {
      ...group,
      balance,
      held: heldAmount(balance),
      itemHeldTotal,
      items: groupItems,
    };
  });

  const heldTotal = groups.reduce((sum, group) => sum + group.held, 0);
  const netBalance = items.reduce((sum, item) => sum + item.balance, 0);

  return { items, groups, heldTotal, netBalance };
}
