const DEFAULT_COMPANY = {
  legalName: "Shoraka Global Resources Sdn. Bhd.",
  registrationNumber: "201501030089 (1155412-V)",
  address:
    "Level 19, Wisma Mont Kiara, 1, Jalan Kiara, Mont Kiara, 50480 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur",
  email: "enquiry@cashsouk.com",
  phone: "03-2708 8100",
} as const;

function envOrDefault(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

/** Public company details shown in marketing and portal footers. */
export const COMPANY = {
  legalName: envOrDefault(process.env.NEXT_PUBLIC_COMPANY_LEGAL_NAME, DEFAULT_COMPANY.legalName),
  registrationNumber: envOrDefault(
    process.env.NEXT_PUBLIC_COMPANY_REGISTRATION_NUMBER,
    DEFAULT_COMPANY.registrationNumber
  ),
  address: envOrDefault(process.env.NEXT_PUBLIC_COMPANY_ADDRESS, DEFAULT_COMPANY.address),
  email: envOrDefault(process.env.NEXT_PUBLIC_COMPANY_EMAIL, DEFAULT_COMPANY.email),
  phone: envOrDefault(process.env.NEXT_PUBLIC_COMPANY_PHONE, DEFAULT_COMPANY.phone),
};

export function companyTelHref(phone: string = COMPANY.phone): string {
  const compact = phone.replace(/[\s-]/g, "");
  if (compact.startsWith("+")) return `tel:${compact}`;
  if (compact.startsWith("0")) return `tel:+60${compact.slice(1)}`;
  return `tel:${compact}`;
}

export function companyCopyrightLine(now: Date = new Date()): string {
  return `Copyright © ${now.getFullYear()} ${COMPANY.legalName} (Registration No. ${COMPANY.registrationNumber}). All Rights Reserved.`;
}
