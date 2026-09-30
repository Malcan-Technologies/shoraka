---
title: Financial Review
description: "How the Financial Summary works in Admin application review: historical years, CTOS, Admin Input, User Input, editing, and how reviewed figures are reused."
category: Application Review
tags:
  - admin
  - financial
  - application review
order: 12
updated: 2026-10-01
---

## Purpose

Use this guide on the **Financial** tab of Application Review. It explains the **Financial Summary**: which years appear, where each column comes from, when you can add or edit figures, and how those reviewed figures are reused later.

The wider review workflow (approve, reject, amendment, and later tabs) is in **Financing Application Review**.

## Historical years

The Financial Summary always shows three historical year columns. They are the three financial years before the latest **User Input** year.

Example: the latest User Input year is FY2026.

Historical years:

- FY2023
- FY2024
- FY2025

User Input is shown in its own columns. It does not replace those historical years.

If User Input already includes FY2025 and FY2026, the historical years are still FY2023, FY2024, and FY2025. FY2025 User Input and FY2026 User Input appear beside them.

## Source labels

Each historical year has one active source.

- **CTOS** — financial data returned by CTOS for that exact year.
- **Admin Input** — a whole historical statement you entered because CTOS did not provide that year.
- **User Input** — the financial statement the issuer submitted. This is a separate column, not the historical source.
- **—** — no active financial statement exists for that historical year.

## When you can add a statement

Before CTOS has been pulled, a missing historical year is read-only. You cannot add a whole statement for that year.

After CTOS has been pulled, if CTOS does not return a historical year, use **Add statement**. That year becomes **Admin Input**.

Example: CTOS was pulled, but FY2025 was not returned. You may add FY2025. The source becomes **Admin Input**.

## When CTOS later supplies a year

CTOS takes priority over an Admin Input statement for the same historical year.

If you added FY2025 because CTOS did not have it, and a later CTOS pull returns FY2025:

- CTOS becomes the active historical source.
- The old Admin Input statement is no longer shown as the active column.
- The old Admin Input statement stays stored for audit and history.
- The old Admin Input statement is not used in calculations.

Do not delete that historical Admin Input. It remains available as history.

## Missing CTOS fields

On a real CTOS year, values that CTOS provided are read-only.

You may fill only fields that CTOS did not provide. These are Admin CTOS gap-fills. They sit on the CTOS year. They are not the same as adding a whole **Admin Input** statement.

A gap-fill counts as a reviewed figure. Calculated rows on that year, such as Net Profit Margin, use the gap-filled value.

## User Input stays separate

User Input is shown separately from the historical source for the same year. Both can appear together.

Example:

- FY2025 CTOS
- FY2025 User Input
- FY2026 User Input

This is valid. Use it to compare historical or reference data with the figures the issuer submitted.

## What you can edit

While the Financial review section is open, you may:

- Add a missing historical statement
- Edit an Admin Input statement
- Edit individual User Input fields
- Fill missing CTOS fields
- Edit one financial field directly from the table

Values you enter use the same number rules as the issuer Financial Statements form. A valid number is required. Zero is a valid amount where the field allows it.

Calculated fields stay read-only. They update from the raw figures.

## Required fields on a whole statement

A whole **Admin Input** statement needs every raw financial field, except:

- Share Application Account
- Share Premium & Other Reserves
- Equity Minority Interest

The add-statement window shows how many required fields are completed, how many remain, and completion for each section.

Numeric 0 counts as a completed value. Calculated fields are read-only and are not part of that required list.

## When editing is locked

Two things control whether you can edit: the Financial section status, and whether the application is still under review.

When the application is under review and Financial is open, or has been reopened, **Add statement** and **Edit statement** are available.

When Financial is **Approved**:

- Financial data is read-only.
- **Add statement** is hidden.
- Edit actions show **Locked** or **Read only**.
- You can still view the figures.

When the application is no longer under review (for example, it is completed, rejected, or withdrawn), Financial data is read-only whatever the Financial section status. Edit actions show **Application is no longer under review**.

If Financial is reopened through an amendment on the Financial section while the application is still under review, editing is available again. Reopening does not delete anything: the existing User Input, Admin Input, CTOS data, gap-fills, and Admin edits are all still there. You edit the working figures again and approve a new reviewed result.

An amendment on another section does not unlock Financial while the Financial section remains approved.

## Issuer Profile

The issuer profile shows the effective reviewed financial history. For a previous financial year, the profile uses one source, in this order:

1. CTOS, plus any Admin CTOS gap-fills for fields CTOS left blank
2. Otherwise, Admin Input
3. Otherwise, User Input, including your edits to those issuer figures
4. Otherwise, blank

A blank field stays blank. The profile does not fill it from an older or unrelated year.

## New application starting values

When an issuer starts a new application, completed years are copied once.

The current financial year always starts blank.

Each previous year uses:

1. CTOS, plus Admin CTOS gap-fills
2. Otherwise, Admin Input
3. Otherwise, the reviewed previous User Input
4. Otherwise, blank

That copy happens once, when the new application is prepared. Later changes to CTOS, Admin Input, or the issuer profile do not silently rewrite an application that already exists.

## Reviewed figures for the Note and Prospectus

Financial Review determines the final reviewed figures for each financial year. Once Financial is approved, those reviewed figures are what the Note and its Prospectus use. The Prospectus does not choose its own sources.

For each financial year, the reviewed figures use:

1. Reviewed User Input, including your edits to those issuer figures
2. Otherwise, CTOS, plus your Admin CTOS gap-fills for fields CTOS left blank
3. Otherwise, the active Admin Input statement for that year
4. Otherwise, blank

This is decided separately for each year, so different years can come from different sources.

Example:

- FY2024 uses CTOS
- FY2025 uses User Input
- FY2026 uses Admin Input

**User Input**

If User Input exists for a year, it is used first. That includes your edits to the issuer figures. CTOS and Admin Input are not used for that year.

Example: the issuer submitted FY2025 Trade Receivables as RM10, and you changed it to RM12. The reviewed figure for FY2025 is RM12, even when CTOS and Admin Input also exist for FY2025.

**CTOS**

If there is no User Input for a year, but CTOS has that exact financial year, CTOS is used.

The reviewed figures are the CTOS values plus your gap-fills where CTOS left a field blank. A whole-year Admin Input statement is not used to overwrite CTOS or to fill those gaps, and User Input from another year is not used.

A CTOS year owns its financial year even when its amounts are blank. If Admin Input for that year was added earlier and CTOS later returns the same year, CTOS is used. The old Admin Input stays stored for audit and is not used.

**Admin Input**

If a year has no User Input and no CTOS, the active Admin Input statement for that year is used.

Example:

FY2025:

- no User Input
- no CTOS
- Admin Input exists

Result: FY2025 uses Admin Input. The year is not left blank.

Only an active Admin Input statement is used. A superseded Admin Input statement is never a source.

**Why the issuer profile looks different**

The issuer profile and a new application’s historical prefill prefer CTOS plus CTOS gap-fills, then Admin Input, then reviewed User Input. They keep the historical-source order.

The reviewed figures for the Note and Prospectus put reviewed User Input first, so they reflect the reviewed application figures.

**After Financial is approved**

- When a Note is created, it takes the reviewed figures as approved at that time.
- Later changes to CTOS, User Input, or Admin Input do not automatically change a Note that already exists, or a Prospectus that is already approved.
- If Financial is reopened while the application is still under review, you can edit the working figures again and approve a new reviewed result. Reopening does not delete the existing User Input, Admin Input, CTOS data, or your edits.
- A Note created after that new approval uses the new reviewed figures.

## Admin changes to issuer figures

If the issuer submitted Trade Receivables as RM10, and you change it to RM12:

- The Admin Financial Summary uses RM12 as the reviewed value.
- The issuer profile shows RM12.
- A Note created after Financial is approved uses RM12 for that year.
- A later application uses RM12 for that year when User Input is the selected source.

The original RM10 stays in the application, revision, and audit history.

## Calculated fields

Calculated fields cannot be edited directly. They recalculate from the active raw values.

Some calculations need the previous financial year. The previous year is taken from the active source only. A superseded Admin Input statement is never used.

- For a User Input year: previous User Input, then previous CTOS, then active Admin Input.
- For a CTOS year: previous CTOS, then active Admin Input.
- For an Admin Input year: previous CTOS, then active Admin Input.

If the previous year value is missing, the calculation stays unavailable. Zero is a real value and is used.

A missing figure is never treated as zero. If a raw figure a calculation needs is blank, the calculated row shows **Cannot calculate** rather than a number built on zero.

## Examples

**CTOS did not return a year**

CTOS was pulled and did not return FY2025. You add FY2025. The historical source becomes **Admin Input**.

**CTOS later returns that year**

A later CTOS pull returns FY2025. The historical source becomes **CTOS**. The earlier Admin Input statement stays stored for audit only and is not used in calculations.

**CTOS and User Input for the same year**

FY2025 CTOS and FY2025 User Input are both shown. The historical CTOS column and the issuer User Input column stay separate so you can compare them.
