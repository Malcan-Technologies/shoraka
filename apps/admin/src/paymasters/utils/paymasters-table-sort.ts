import { isPaymasterVerified, type PaymasterListItem } from "@cashsouk/types";
import { timestampOrNull, type TableSortValue } from "@/shared/admin-list/table-sort";

export type PaymastersSortColumn =
  | "paymaster"
  | "registration"
  | "country"
  | "entityType"
  | "issuers"
  | "facilities"
  | "notes"
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
    case "registration":
      return item.registrationNumber;
    case "country":
      return item.registrationCountry;
    case "entityType":
      return item.entityType;
    case "issuers":
      return item.linkedIssuerCount;
    case "facilities":
      return item.linkedFacilityCount;
    case "notes":
      return item.linkedNoteCount;
    case "notices":
      return item.noticeCount;
    case "lastUsed":
      return timestampOrNull(item.lastUsedAt) ?? timestampOrNull(item.createdAt);
    case "status":
      return isPaymasterVerified(item.verificationStatus) ? 0 : 1;
  }
}
