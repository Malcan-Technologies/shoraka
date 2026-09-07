export type PaymasterCountryOption = { code: string; name: string };

/** ISO codes for Paymaster registration country. Browsers reject Intl.supportedValuesOf with a region key. */
const PAYMASTER_COUNTRY_CODES = [
  "MY",
  "SG",
  "ID",
  "TH",
  "BN",
  "PH",
  "VN",
  "CN",
  "HK",
  "JP",
  "KR",
  "AU",
  "GB",
  "US",
];

function regionDisplayNames(): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
}

function countryName(code: string, display: Intl.DisplayNames | null): string {
  if (!display) return code;
  try {
    return display.of(code) ?? code;
  } catch {
    return code;
  }
}

export function paymasterCountryOptions(currentCode?: string): PaymasterCountryOption[] {
  const display = regionDisplayNames();
  const codes = new Set(PAYMASTER_COUNTRY_CODES);
  const current = currentCode?.trim().toUpperCase();
  if (current && /^[A-Z]{2}$/.test(current)) codes.add(current);
  return [...codes]
    .map((code) => ({ code, name: countryName(code, display) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
