/**
 * Demo merge payload for ARF-i contract facility Letter of Offer.
 * Temporary — not production Send Offer.
 */

export type ContractLooMergeData = {
  issuer_id: string;
  our_reference: string;
  letter_date: string;
  issuer_name: string;
  issuer_registration_number: string;
  issuer_address: string;
  attention_name: string;
  attention_position: string;
  financing_limit_rm: string;
  margin_of_receivable_percent: string;
  profit_rate_percent: string;
  tenure_days: string;
  availability_period_phrase: string;
  guarantor_1_line: string;
  guarantor_2_line: string;
  guarantor_3_line: string;
  guarantor_1_name: string;
  guarantor_2_name: string;
  payment_period_days: string;
  grace_period_days: string;
  grace_period_days_words: string;
  transaction_docs_days: string;
  transaction_docs_days_words: string;
  withdrawal_notice_phrase: string;
  offer_validity_phrase: string;
  assigned_contract_date: string;
  assigned_contract_counterparty: string;
  assigned_contract_description: string;
  moa_authorised_signatory_names: string;
  corporate_guarantor_name: string;
  corporate_guarantor_ssm: string;
  corporate_signatory_1_name: string;
  corporate_signatory_2_name: string;
};

export const CONTRACT_LOO_MERGE_KEYS = [
  "issuer_id",
  "our_reference",
  "letter_date",
  "issuer_name",
  "issuer_registration_number",
  "issuer_address",
  "attention_name",
  "attention_position",
  "financing_limit_rm",
  "margin_of_receivable_percent",
  "profit_rate_percent",
  "tenure_days",
  "availability_period_phrase",
  "guarantor_1_line",
  "guarantor_2_line",
  "guarantor_3_line",
  "guarantor_1_name",
  "guarantor_2_name",
  "payment_period_days",
  "grace_period_days",
  "grace_period_days_words",
  "transaction_docs_days",
  "transaction_docs_days_words",
  "withdrawal_notice_phrase",
  "offer_validity_phrase",
  "assigned_contract_date",
  "assigned_contract_counterparty",
  "assigned_contract_description",
  "moa_authorised_signatory_names",
  "corporate_guarantor_name",
  "corporate_guarantor_ssm",
  "corporate_signatory_1_name",
  "corporate_signatory_2_name",
] as const satisfies ReadonlyArray<keyof ContractLooMergeData>;
