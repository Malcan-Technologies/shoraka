# @shoraka/config

Shared configuration, utilities, and API clients for the Shoraka platform.

## Contents

### API Client

Typed API client for making requests to the Shoraka backend.

```typescript
import { apiClient } from "@shoraka/config";
```

### Currency Utilities

Consistent Malaysian Ringgit (MYR) formatting across the platform.

```typescript
import { formatCurrency, formatNumber, parseCurrency } from "@shoraka/config";

// Format with currency symbol (default)
formatCurrency(1000);           // "RM 1,000.00"
formatCurrency(1234.56);        // "RM 1,234.56"

// Format without decimals
formatCurrency(1000, { decimals: 0 });  // "RM 1,000"

// Format without symbol
formatCurrency(1000, { includeSymbol: false });  // "1,000.00"

// Format numbers only (no currency)
formatNumber(1000);             // "1,000"
formatNumber(1234.56, 2);       // "1,234.56"

// Parse currency strings back to numbers
parseCurrency("RM 1,000.00");   // 1000
parseCurrency("1,234.56");      // 1234.56
```

#### Currency Format Options

```typescript
interface CurrencyFormatOptions {
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
```

#### Best Practices

1. **Always use MYR**: The platform is Malaysian Ringgit only
2. **Use commas**: Large numbers should always have thousand separators (e.g., `1,000`)
3. **Decimal places**: Use 2 decimal places for precise amounts, 0 for whole numbers
4. **Consistency**: Import from `@shoraka/config` to ensure formatting is consistent across all portals

#### Examples

```typescript
// Stats display (no decimals needed)
formatCurrency(284500, { decimals: 0 });  // "RM 284,500"

// Precise amounts (loan amounts, payments)
formatCurrency(1234.56);  // "RM 1,234.56"

// Table columns (clean numbers)
formatNumber(1234.56, 2);  // "1,234.56"

// User input parsing
const userInput = "RM 5,000.00";
const amount = parseCurrency(userInput);  // 5000
```

