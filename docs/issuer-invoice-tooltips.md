# Issuer invoice step — tooltip reference

Source: `apps/issuer/src/app/(application-flow)/applications/steps/invoice-details-step.tsx` and `lib/product-rule-hints.ts`  
Scope: tooltips and muted hints on the issuer invoice step.

This file documents existing copy only — no changes to UI behavior.

## Dynamic values

- `displayMinRatio` — `productConfig.min_financing_ratio_percent ?? 60`
- `displayMaxRatio` — `productConfig.max_financing_ratio_percent ?? 80`
- `productConfig.min_invoice_value` — per-invoice **min financing amount** (RM, optional)
- `productConfig.max_invoice_value` — per-invoice **max financing amount** (RM, optional)
- `productConfig.min_invoice_face_value` — per-invoice **min invoice face value** (RM, optional)
- `productConfig.max_invoice_face_value` — per-invoice **max invoice face value** (RM, optional)
- `productConfig.sub_limit_per_invoice_rm` — facility **sub-limit per invoice** (RM, optional; financing cap, facility invoices only)

> Financing keys (`min_invoice_value` / `max_invoice_value`) still enforce the **financing amount** (`invoice value × ratio`). Face-value keys (`min_invoice_face_value` / `max_invoice_face_value`) enforce the raw invoice value. Admin product config labels them “Minimum / Maximum financing amount (RM)” and “Minimum / Maximum invoice value (RM)”.

## Tooltips

| Column / Field | When it appears | Tooltip message | Notes |
|---|---|---|---|
| Maturity Date (header) | Always | Invoice maturity date is the deadline when your customer is required to pay for this invoice. For example, if your invoice date is 1st of January, and your payment term is 60 days, the maturity date is 1st of March. | Static copy. |
| Invoice value | Always | Invoice value is the total face value of the invoice.<br><br>**Limits block (when face-value keys are set):**<br>• Allowed invoice value:<br>• Min RM `{min_invoice_face_value}` *(only when min is set)*<br>• Max RM `{max_invoice_face_value}` *(only when max is set)* | From `buildInvoiceValueTooltip`. First line always shown. |
| Financing Ratio (header) | Always | Allowed ratio: `{displayMinRatio}`%–`{displayMaxRatio}`%. If you edit the financing amount, the ratio will round up and stay within this range. | Range is dynamic from product config. |
| Financing amount | Always | **Calculation + sync (always shown):**<br>• Financing amount is calculated from the invoice value and financing ratio.<br>• If you edit this amount, the financing ratio will update automatically.<br><br>**Limits block (only when at least one of `min_invoice_value` / `max_invoice_value` is a number):**<br>• Per invoice financing limit:<br>• Min RM `{min_invoice_value}` *(only when min is set)*<br>• Max RM `{max_invoice_value}` *(only when max is set)* | Renamed from “Maximum Financing Amount”. Financing keys unchanged. RM values are formatted via `formatMoney`. |

## Hints (muted helper text, not tooltips)

| Field | When it appears | Copy |
|---|---|---|
| Invoice value | When a face-value limit is set | `Min RM …` / `Max RM …` / `Allowed: RM … – RM …` (`buildInvoiceValueHint`) |
| Financing amount | When a financing min/max or (facility) sub-limit is set | `Min RM … · Max RM … · Facility sub-limit RM …` (`buildFinancingAmountHint`; sub-limit omitted for `invoice_only`) |
| Financing amount | Always | “Based on `{ratioNum}%` ratio” |

## No tooltip found

These columns/fields in the invoice table currently have **no** tooltip:

- Invoice (header / row input)
- Status (header / row badge)
- Documents (header)
- Documents row controls (`Upload` link, `FileDisplayBadge`, locked badge, remove `×`, delete `🗑`)
- Sliders, ratio chip, and totals row (`RM {totalFinancingAmount}` / `Total`)

## Notes

- Header tooltip triggers and content use shared classes: `fieldTooltipTriggerClassName` and `fieldTooltipContentClassName` from `@cashsouk/ui`.
- All header tooltips render on `side="top"` with `sideOffset={2}`.
