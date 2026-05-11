# Issuer invoice step — tooltip reference

Source: `apps/issuer/src/app/(application-flow)/applications/steps/invoice-details-step.tsx`  
Scope: tooltips that appear in the **Invoices** table on the issuer invoice step.

This file documents existing copy only — no changes to UI behavior.

## Dynamic values

- `displayMinRatio` — `productConfig.min_financing_ratio_percent ?? 60`
- `displayMaxRatio` — `productConfig.max_financing_ratio_percent ?? 80`
- `productConfig.min_invoice_value` — per-invoice **min financing amount** (RM, optional)
- `productConfig.max_invoice_value` — per-invoice **max financing amount** (RM, optional)

> Note: keys named `min_invoice_value` / `max_invoice_value` enforce the **financing amount** (`invoice value × ratio`), not the raw invoice value. Admin product config labels them “Minimum / Maximum financing amount (RM)”.

## Tooltips

| Column / Field | When it appears | Tooltip message | Notes |
|---|---|---|---|
| Maturity Date (header) | Always | Invoice maturity date is the deadline when your customer is required to pay for this invoice. For example, if your invoice date is 1st of January, and your payment term is 60 days, the maturity date is 1st of March. | Static copy. |
| Financing Ratio (header) | Always | Allowed ratio: `{displayMinRatio}`%–`{displayMaxRatio}`%. If you edit the maximum financing amount, the ratio will round up and stay within this range. | Range is dynamic from product config. |
| Maximum Financing Amount (header) | Always | **Calculation + sync (always shown):**<br>• Maximum financing amount is calculated from the invoice value and financing ratio.<br>• If you edit this amount, the financing ratio will update automatically.<br><br>**Limits block (only when at least one of `min_invoice_value` / `max_invoice_value` is a number):**<br>• Per invoice financing limit:<br>• Min RM `{min_invoice_value}` *(only when min is set)*<br>• Max RM `{max_invoice_value}` *(only when max is set)* | Single tooltip; the limit block is conditional and may show min only, max only, or both. RM values are formatted via `formatMoney`. |

## No tooltip found

These columns/fields in the invoice table currently have **no** tooltip:

- Invoice (header / row input)
- Status (header / row badge)
- Invoice Value (header / row input)
- Documents (header)
- Documents row controls (`Upload` link, `FileDisplayBadge`, locked badge, remove `×`, delete `🗑`)
- The “Based on `{ratioNum}%` ratio” helper text below Maximum Financing Amount input (visible muted text, not a tooltip)
- Sliders, ratio chip, and totals row (`RM {totalFinancingAmount}` / `Total`)

## Notes

- Header tooltip triggers and content use shared classes: `fieldTooltipTriggerClassName` and `fieldTooltipContentClassName` from `@cashsouk/ui`.
- All header tooltips render on `side="top"` with `sideOffset={2}`.
