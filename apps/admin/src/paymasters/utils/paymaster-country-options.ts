export type PaymasterCountryOption = { code: string; name: string };

const FALLBACK_COUNTRY_CODES = [
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

export function paymasterCountryOptions(currentCode?: string): PaymasterCountryOption[] {
  const display = new Intl.DisplayNames(["en"], { type: "region" });
  const supportedValuesOf = (
    Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  const supported =
    typeof supportedValuesOf === "function"
      ? supportedValuesOf("region").filter((code) => /^[A-Z]{2}$/.test(code))
      : FALLBACK_COUNTRY_CODES;
  const codes = new Set(supported);
  const current = currentCode?.trim().toUpperCase();
  if (current && /^[A-Z]{2}$/.test(current)) codes.add(current);
  return [...codes]
    .map((code) => ({ code, name: display.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
