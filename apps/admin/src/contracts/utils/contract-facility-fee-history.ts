import type { GatewayPaymentListItemDto } from "@cashsouk/types";

export type FacilityFeeHistoryState = "loading" | "error" | "empty" | "ready";

export function resolveFacilityFeeHistoryState(input: {
  isLoading: boolean;
  isError: boolean;
  items: GatewayPaymentListItemDto[];
}): FacilityFeeHistoryState {
  if (input.isLoading) return "loading";
  if (input.isError) return "error";
  if (input.items.length === 0) return "empty";
  return "ready";
}

export function facilityFeePaymentReference(item: Pick<
  GatewayPaymentListItemDto,
  "curlecPaymentId" | "curlecOrderId"
>): string | null {
  const payment = item.curlecPaymentId?.trim();
  if (payment) return payment;
  const order = item.curlecOrderId?.trim();
  return order || null;
}
