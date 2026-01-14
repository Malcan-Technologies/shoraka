import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format raw event type strings into human-readable labels
 * Handles special cases like T&C, KYC, AML, SSM, etc.
 */
export function formatEventType(eventType: string): string {
  // 1. Map specific abbreviations or full names
  const mapping: Record<string, string> = {
    TNC: "T&C",
    KYC: "KYC",
    AML: "AML",
    SSM: "SSM",
    MFA: "MFA",
    "2FA": "2FA",
  };

  // 2. Split by underscore, format each word, and join
  return eventType
    .split("_")
    .map((word) => {
      const upperWord = word.toUpperCase();
      // Use mapping if exists, otherwise title case
      return mapping[upperWord] || word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

