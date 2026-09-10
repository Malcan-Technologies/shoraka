---
title: Report Center
description: Generate credit-quality, origination, investor, treasury, and regulatory extracts, then export CSV or XLSX.
category: Note Operations
tags:
  - admin
  - reports
  - npl
order: 22
updated: 2026-09-09
---

## Overview

**Reports** is the admin extract library. It is grouped into four tabs: credit quality, origination, investors & treasury, and regulatory. The page is gated by `reports.view`.

Every available report uses inclusive **Malaysia calendar days**. Range reports default to this month; as-of reports default to today (live book). Historical as-of dates use the snapshot written after that Malaysia day closed (the 00:30 MYT job). Dates before snapshots exist show “No snapshot for this date”. Custom dates apply only after you press Apply.

ComRep is listed under Regulatory as a placeholder and is not available yet.

## Credit quality

- **Portfolio ageing** — each live funded note, DPD, bucket, outstanding, and indicative late charges. The page also shows **portfolio at risk**: past due (DPD > 0), PAR30/60/90 (cumulative, DPD greater than that threshold), and internally marked default. PAR90 is the SC/BNM >90 DPD test. Bucket totals below that are exclusive DPD bands. Use **As of** for a historical snapshot date. Today always computes live.

Admins with `reports.view` also see **Credit quality** on the dashboard: PAR90 against the 5.0% SC limit, the cumulative PAR ladder, and exclusive DPD buckets (a note appears once). The ageing report page still shows the PAR gauge tiles.
- **NPL** — two tests on the same book: internal NPL (`ARREARS` or `DEFAULTED`) and SC/BNM >90 DPD. Filter or read both columns. Summaries include NPL ratio against outstanding.
- **Late fees** — posted settlements in the date range, plus pre-settlement waivers that have no settlement yet (shown as Waiver). Ta'widh and Gharamah applied, waived, collected, investor vs platform vs charity split, and excess owed/paid. The range is inclusive Malaysia calendar days.
- **Default & recovery** — each defaulted note: default date and reason, funded principal, recovered amounts, outstanding, recovery %, and days since default (Malaysia calendar days).

## Origination

- **Origination & funding** — one row per note that was published or had funding close in the period. Outcome is Funded, Failed, Open, Closed, or Not listed. Days open are Malaysia calendar days from published to funding closed (open listings use the report To date). Application funnel summaries count submissions in the period and exclude drafts and archived applications.
- **Portfolio composition** — the current or historical **open book** grouped by start month, issuer, paymaster, or sector. Live book matches ageing (`FUNDED`, not `SETTLED`). Share of book is group outstanding ÷ book outstanding. Default exposure is defaulted outstanding ÷ group outstanding. This is concentration, not lifetime vintage performance. PAR tiles are not shown.

## Investors & treasury

- **Investor book** — one row per investor with a wallet or any investment. Holdings (available cash, reserved commitments, confirmed principal on unsettled notes, expected net rate) are **current**. Cash added, withdrawals, refunds, and realised principal / net profit / Ta'widh use the **selected period**. Realised columns read frozen settlement allocations; they are not rebuilt from current percentages. Cash added is gateway deposits and manual top-ups. Temporary refund holds and investment commit/release movements are excluded.
- **Trust & revenue** — opening, period credits/debits, and closing for Investor Pool, Repayment Pool, Operating, Ta'widh, Gharamah, and Issuer Payable. Opening is credits minus debits before the range. Summary lines (drawdown fee, service fee, gateway fees, issuer residual, Ta'widh, Gharamah) explain movements already included in bucket totals. **Do not add those summaries to opening or closing balances.** Revenue is actual ledger postings, not rate × principal estimates.

## Regulatory

- **ComRep** — placeholder. Not available yet.

## Export

Open a report, set the period (and breakdown, where shown), then **Export CSV** or **Export XLSX**. The file matches the on-screen columns plus the summary rows.

## Related

See [Note Money Flow and Servicing Guide](/help/admin-note-money-flow) for how overdue, late, arrears, and default are marked.
