export type ShorakaTradeOrderPhaseStatus = "PENDING_SUBMISSION" | "SUBMITTED" | "STATUS_FETCHED" | "CERTIFICATE_READY" | "FAILED";

export type ShorakaSubmitOrderValues = {
  product_type: string;
  commodity_type: string;
  ownership: string;
  value_date: string;
  order_currency: string;
  order_amount: string; // formatted to 2 decimals
  murabaha_amount: string; // formatted to 2 decimals
  tenor: string;
  tenor_other: string;
  tenor_other_unit: string;
  order_type: string;
};

