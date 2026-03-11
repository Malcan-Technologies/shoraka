import type { GetAdminContractsParams } from "@cashsouk/types";

export const contractsKeys = {
  all: ["admin", "contracts"] as const,
  list: (params: GetAdminContractsParams) =>
    [...contractsKeys.all, "list", params] as const,
  detail: (contractId: string) =>
    [...contractsKeys.all, "detail", contractId] as const,
};
