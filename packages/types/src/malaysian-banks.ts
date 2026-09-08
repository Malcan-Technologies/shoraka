/**
 * Organisation banking picklist (RegTank values) plus head-office SWIFT/BIC.
 * Codes are the published 8-character Malaysia BICs for each institution.
 */

export const MALAYSIAN_BANKS = [
  { value: "Affin Bank Berhad", label: "Affin Bank", swift: "PHBMMYKL" },
  { value: "Alliance Bank Malaysia Berhad", label: "Alliance Bank", swift: "MFBBMYKL" },
  { value: "AmBank / AmFinance Berhad", label: "AmBank", swift: "ARBKMYKL" },
  { value: "Bangkok Bank Berhad", label: "Bangkok Bank", swift: "BKKBMYKL" },
  { value: "Bank Islam Malaysia Berhad", label: "Bank Islam", swift: "BIMBMYKL" },
  {
    value: "Bank Kerjasama Rakyat Malaysia Berhad (Bank Rakyat)",
    label: "Bank Rakyat",
    swift: "BKRMMYKL",
  },
  { value: "Bank Muamalat Malaysia Berhad", label: "Bank Muamalat", swift: "BMMBMYKL" },
  { value: "Bank Pertanian Malaysia Berhad (Agrobank)", label: "Agrobank", swift: "AGOBMYK1" },
  { value: "Bank Simpanan Nasional Berhad (BSN)", label: "BSN", swift: "BSNAMYK1" },
  { value: "Bank of America", label: "Bank of America", swift: "BOFAMY2X" },
  { value: "Bank of China (Malaysia) Berhad", label: "Bank of China", swift: "BKCHMYKL" },
  { value: "CIMB Bank Berhad", label: "CIMB Bank", swift: "CIBBMYKL" },
  {
    value: "Co-operative Bank of Malaysia Berhad (Co-opbank Pertama)",
    label: "Co-opbank Pertama",
    swift: "KCPMMYK1",
  },
  { value: "Deutsche Bank (Malaysia) Berhad", label: "Deutsche Bank", swift: "DEUTMYKL" },
  { value: "Hong Leong Bank Berhad", label: "Hong Leong Bank", swift: "HLBBMYKL" },
  { value: "JP Morgan Chase Bank Berhad", label: "JP Morgan Chase", swift: "CHASMYKL" },
  { value: "Maybank / Malayan Banking Berhad", label: "Maybank", swift: "MBBEMYKL" },
  { value: "Public Bank Berhad", label: "Public Bank", swift: "PBBEMYKL" },
  { value: "RHB Bank Berhad", label: "RHB Bank", swift: "RHBBMYKL" },
  {
    value: "Standard Chartered Bank Malaysia Berhad",
    label: "Standard Chartered",
    swift: "SCBLMYKX",
  },
  {
    value: "Sumitomo Mitsui Banking Corporation Malaysia Berhad",
    label: "Sumitomo Mitsui",
    swift: "SMBCMYKL",
  },
  {
    value: "United Overseas Bank (Malaysia) Berhad",
    label: "UOB Malaysia",
    swift: "UOVBMYKL",
  },
  { value: "UOB Bank Berhad", label: "UOB Bank", swift: "UOVBMYKL" },
] as const;

function exactBankName(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function malaysianBankLabel(value: string): string {
  const match = MALAYSIAN_BANKS.find((bank) => bank.value === value);
  return match?.label ?? value;
}

/**
 * Head-office SWIFT/BIC for an exact picklist value or short label.
 * Does not substring-match, so “Maybank Islamic Berhad” will not resolve.
 */
export function malaysianBankSwift(bankName: string): string {
  const name = bankName.trim();
  if (!name) return "";

  const match = MALAYSIAN_BANKS.find(
    (bank) => exactBankName(bank.value, name) || exactBankName(bank.label, name)
  );
  return match?.swift ?? "";
}
