/**
 * Currency formatting utilities for Malaysian Ringgit (MYR)
 * Provides consistent formatting across the entire platform
 */

export const CURRENCY_CODE = "MYR";
export const CURRENCY_SYMBOL = "RM";

export interface CurrencyFormatOptions {
  /**
   * Number of decimal places (0 or 2)
   * @default 2
   */
  decimals?: 0 | 2;
  
  /**
   * Whether to include the currency symbol
   * @default true
   */
  includeSymbol?: boolean;
  
  /**
   * Whether to include commas as thousand separators
   * @default true
   */
  useCommas?: boolean;
}

/**
 * Format a number as Malaysian Ringgit currency
 * @example
 * formatCurrency(1000) // "RM 1,000.00"
 * formatCurrency(1000, { decimals: 0 }) // "RM 1,000"
 * formatCurrency(1000.50, { includeSymbol: false }) // "1,000.50"
 */
export function formatCurrency(
  amount: number,
  options: CurrencyFormatOptions = {}
): string {
  const {
    decimals = 2,
    includeSymbol = true,
    useCommas = true,
  } = options;

  // Round to specified decimal places
  const rounded = decimals === 0 
    ? Math.round(amount)
    : Math.round(amount * 100) / 100;

  // Format with commas and decimals
  let formatted: string;
  
  if (useCommas) {
    formatted = rounded.toLocaleString("en-MY", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  } else {
    formatted = rounded.toFixed(decimals);
  }

  // Add currency symbol if requested
  return includeSymbol ? `${CURRENCY_SYMBOL} ${formatted}` : formatted;
}

/**
 * Format a number with commas (no currency symbol)
 * @example
 * formatNumber(1000) // "1,000"
 * formatNumber(1000.50, 2) // "1,000.50"
 */
export function formatNumber(amount: number, decimals: 0 | 2 = 0): string {
  return amount.toLocaleString("en-MY", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parse a currency string back to a number
 * @example
 * parseCurrency("RM 1,000.00") // 1000
 * parseCurrency("1,000.50") // 1000.50
 */
export function parseCurrency(value: string): number {
  // Remove currency symbol, spaces, and commas
  const cleaned = value.replace(/[RM,\s]/g, "");
  return parseFloat(cleaned) || 0;
}

