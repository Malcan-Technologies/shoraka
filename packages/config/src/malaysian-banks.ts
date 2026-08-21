/** Values match RegTank picklist format used on organisation banking profiles. */
export const MALAYSIAN_BANKS = [
  { value: "Affin Bank Berhad", label: "Affin Bank" },
  { value: "Alliance Bank Malaysia Berhad", label: "Alliance Bank" },
  { value: "AmBank / AmFinance Berhad", label: "AmBank" },
  { value: "Bangkok Bank Berhad", label: "Bangkok Bank" },
  { value: "Bank Islam Malaysia Berhad", label: "Bank Islam" },
  { value: "Bank Kerjasama Rakyat Malaysia Berhad (Bank Rakyat)", label: "Bank Rakyat" },
  { value: "Bank Muamalat Malaysia Berhad", label: "Bank Muamalat" },
  { value: "Bank Pertanian Malaysia Berhad (Agrobank)", label: "Agrobank" },
  { value: "Bank Simpanan Nasional Berhad (BSN)", label: "BSN" },
  { value: "Bank of America", label: "Bank of America" },
  { value: "Bank of China (Malaysia) Berhad", label: "Bank of China" },
  { value: "CIMB Bank Berhad", label: "CIMB Bank" },
  { value: "Co-operative Bank of Malaysia Berhad (Co-opbank Pertama)", label: "Co-opbank Pertama" },
  { value: "Deutsche Bank (Malaysia) Berhad", label: "Deutsche Bank" },
  { value: "Hong Leong Bank Berhad", label: "Hong Leong Bank" },
  { value: "JP Morgan Chase Bank Berhad", label: "JP Morgan Chase" },
  { value: "Maybank / Malayan Banking Berhad", label: "Maybank" },
  { value: "Public Bank Berhad", label: "Public Bank" },
  { value: "RHB Bank Berhad", label: "RHB Bank" },
  { value: "Standard Chartered Bank Malaysia Berhad", label: "Standard Chartered" },
  { value: "Sumitomo Mitsui Banking Corporation Malaysia Berhad", label: "Sumitomo Mitsui" },
  { value: "United Overseas Bank (Malaysia) Berhad", label: "UOB Malaysia" },
  { value: "UOB Bank Berhad", label: "UOB Bank" },
] as const;

export const BANK_ACCOUNT_TYPES = [
  { value: "Savings", label: "Savings" },
  { value: "Checking", label: "Checking" },
] as const;

export function malaysianBankLabel(value: string): string {
  const match = MALAYSIAN_BANKS.find((bank) => bank.value === value);
  return match?.label ?? value;
}
