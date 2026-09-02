import { isPaymasterVerified, paymasterLinkedFinancingCount, type PaymasterListItem } from "@cashsouk/types";
import { timestampOrNull, type TableSortValue } from "@/shared/admin-list/table-sort";

export type PaymastersSortColumn =
  | "paymaster"
  | "issuers"
  | "financings"
  | "notices"
  | "lastUsed"
  | "status";

export function paymastersSortValue(
  item: PaymasterListItem,
  column: PaymastersSortColumn
): TableSortValue {
  switch (column) {
    case "paymaster":
      return item.legalName;
    case "issuers":
      return item.linkedIssuerCount;
    case "financings":
      return paymasterLinkedFinancingCount(item);
    case "notices":
      return item.noticeCount;
    case "lastUsed":
      return timestampOrNull(item.lastUsedAt) ?? timestampOrNull(item.createdAt);
    case "status":
      return isPaymasterVerified(item.verificationStatus) ? 0 : 1;
  }
}
