/** Start a new application pre-filled to finance one invoice against an approved facility. */
export function financeInvoiceApplicationHref(contractId: string): string {
  return `/applications/new?contractId=${encodeURIComponent(contractId)}`;
}

export const EXISTING_CONTRACT_PREFILL_STORAGE_KEY = "cashsouk:existing_contract_prefill_id";
