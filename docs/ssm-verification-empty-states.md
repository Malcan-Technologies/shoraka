# SSM verification — empty states (compare UI)

Reference for admin **SSM Verification** compare cards in `apps/admin/src/components/ssm-verification-panel.tsx`.  
Copy uses the same button labels as the UI: **Fetch report**, **Amendment**.

These empty states appear only when the panel uses the **org report** compare flow (issuer or investor products that load SSM data this way). Company SSM-side states below apply only in that flow.

There is **no** separate generic director fallback (e.g. “No director details to show” / “available for comparison”) in code.

---

## Empty-state reference

| Section | Side | Scenario / when it appears | Title | Message |
|--------|------|----------------------------|-------|---------|
| Company | SSM | Admin has not used **Fetch report** yet for this application. | No company data fetched | Click Fetch report to get the latest SSM data. |
| Company | SSM | A report was opened or fetched but the company block is missing or unusable. | No company data found | Try fetching again or open the report to check the details. |
| Directors | Onboarding | The application side has no directors to show in this compare. | No directors listed | Use Amendment if the applicant needs to update this information. |
| Directors | SSM | The SSM side has no directors and the report has not been fetched yet. | No directors fetched | Click Fetch report to get the latest SSM data. |
| Directors | SSM | The SSM side has no directors after a fetch, or data is loaded but still none to list. | No directors found | Try fetching again or open the report to check the details. |
| Shareholders | Onboarding | Onboarding side has no visible shareholders after applying display rules. | No shareholders listed | Shareholders below 5% are hidden from this view. Use Amendment if the applicant needs to update this information. |
| Shareholders | SSM | SSM shareholder data has not been fetched yet. | No shareholders fetched | Click Fetch report to get the latest SSM data. |
| Shareholders | SSM | SSM data was fetched, but no visible shareholders are available to show. This includes cases where shareholder entries are missing or all shareholders are hidden by the 5% rule. | No shareholders found | Shareholders below 5% are hidden from this view. Try fetching again or open the report to check the details. |

---

## Notes

- **Onboarding** column titles in the UI are the literal heading **Onboarding**; **SSM** is the right-hand column label.
- **Company / Onboarding** always shows the application name and SSM registration when company info exists — there is no empty-state card for that column.
- **Mock mode** and **load error** banners above the compare blocks are developer or error messaging, not the empty-state titles in this table.
