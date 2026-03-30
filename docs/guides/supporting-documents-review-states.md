# Supporting documents review: states and rules

This guide describes how **per-document** review items and the **`supporting_documents`** **section** status relate to each other, including API behavior, activity logging, and admin UI locking.

Implementation reference:

- Section derivation: `apps/api/src/modules/admin/supporting-documents-section-status.ts`
- Service (sync, peer-reject cleanup, blocked section actions): `apps/api/src/modules/admin/service.ts`
- Admin UI: `apps/admin/src/components/application-review/sections/documents-section.tsx`, `document-list.tsx`, `item-action-dropdown.tsx`, `section-action-dropdown.tsx`

---

## Per-document item states

Each uploaded document entry has a **scope key** `supporting_documents:…` and a review row with `item_type = document`.

Allowed statuses (same vocabulary as other review steps):

| Status | Meaning |
|--------|---------|
| **PENDING** | Not yet decided (no row, or explicit pending). |
| **APPROVED** | This document was approved. |
| **REJECTED** | This document was rejected. |
| **AMENDMENT_REQUESTED** | An amendment was requested for this document (may have an unsubmitted draft remark). |

---

## How `supporting_documents` **section** status is derived

The section row is **not** set by section-level Approve / Reject / Request amendment (those API calls are **disabled** for `supporting_documents`). It is **recomputed** from **all** document keys in the application’s supporting-documents payload and the corresponding `application_review_items` rows.

Evaluation order (first match wins):

1. **REJECTED** — if **any** document key has status `REJECTED`.
2. **PENDING** — else if **any** document key is missing a final decision (treated as `PENDING` if there is no row for that key).
3. **APPROVED** — else if **every** document key is `APPROVED`.
4. **AMENDMENT_REQUESTED** — else if **any** document key is `AMENDMENT_REQUESTED` (implies all keys have a non-pending status, and not all are approved).
5. **PENDING** — fallback (e.g. unexpected status mix).

**Empty list:** If there are **no** document keys parsed from `supporting_documents`, the derived section status is **PENDING** and sync may no-op.

When the derived status **changes**, the API updates `application_reviews` for `supporting_documents` and writes an **activity** event `SECTION_REVIEWED_<STATUS>` (e.g. `SECTION_REVIEWED_APPROVED`), with metadata `old_status` / `new_status`.

---

## Scenarios (combinatorial view)

Let **n** be the number of document keys. For each key, status is one of **P**, **A**, **R**, **M** (Pending, Approved, Rejected, Amendment requested).

| Pattern (per-key) | Section status |
|-------------------|----------------|
| Any **R** | **REJECTED** |
| No **R**, any **P** | **PENDING** |
| No **R**, no **P**, all **A** | **APPROVED** |
| No **R**, no **P**, at least one **M** | **AMENDMENT_REQUESTED** |

Examples:

- `A + A + P` → **PENDING** (still waiting on one doc).
- `A + M + M` → **AMENDMENT_REQUESTED** (all decided, not all approved).
- `R + A + A` → **REJECTED** (one rejection dominates).
- `A + A + A` → **APPROVED**.

---

## What triggers a section re-sync

The section is recomputed after **document** item actions that change item state (and related flows), including:

- Approve / reject / request amendment **on a document item**
- **Reset item to pending** for a document
- **Add / update pending amendment** draft on a **document item** (item scope), after status effects
- **Reject document item** — also runs **peer cleanup** (see below), then sync

**Invoice** item actions do not use this derivation.

---

## Peer rejection: one document rejected

When **any** document item is **rejected**:

1. **Sibling amendment drafts** — for every **other** document key, any **unsubmitted** item-scope amendment draft (`REQUEST_AMENDMENT`, `submitted_at` null) is **removed**.
2. **Siblings in `AMENDMENT_REQUESTED`** — each such sibling is **reset to pending** (same behavior as “Set to Pending” on that item, including **`ITEM_REVIEWED_PENDING`** activity logs). Section sync is batched so it runs once after the main reject flow.
3. Siblings that were **APPROVED** (or **PENDING** only) are not forced to a new status by this cleanup beyond **draft removal** where a draft existed without a matching row state (edge case).

Then the **section** status is synced from the full matrix (typically **REJECTED** while the rejected item stays rejected).

---

## API: blocked and allowed operations

| Operation | `supporting_documents` section | Document item |
|-----------|-------------------------------|---------------|
| Section **Approve** | **Blocked** (use per-doc approve) | N/A |
| Section **Reject** | **Blocked** | N/A |
| Section **Request amendment** | **Blocked** | N/A |
| Section **pending amendment draft** (section scope) | **Blocked** | N/A |
| **Approve / reject / request amendment** item | N/A | **Allowed** (when UI not locked — see below) |
| **Reset item to pending** | N/A | **Allowed** (subject to UI lock) |
| **Reset section to pending** (documents) | **Allowed** — resets **all** document items in a loop, each may log item events; section ends **PENDING** when appropriate | — |

---

## Admin UI behavior

### Section header (“Supporting Documents”)

- **Approve / Reject / Request amendment** are **hidden** (section status is derived from items).
- **Set to Pending** remains available when the **section** status is not `PENDING` (resets all document items via API).
- If the section is **PENDING** and there are no other actions, the **Action** menu may be **hidden** entirely.

### Per-document row

- **Peer lock:** If **any** document item is **`REJECTED`**, **Approve**, **Reject**, and **Request amendment** are **hidden** on **all** rows (including the rejected row). **Set to Pending** still appears for rows with status other than `PENDING` (so reviewers can unwind state).
- If a row is **`PENDING`** and peer lock is on, there may be **no** row-level Action menu (nothing to show).

---

## Activity timeline (high level)

- **Item** transitions log `ITEM_REVIEWED_<STATUS>` with `scope_key` = document item id.
- **Section** transitions log `SECTION_REVIEWED_<STATUS>` for `supporting_documents` when the **derived** section status changes.
- Peer reject cleanup may emit multiple **`ITEM_REVIEWED_PENDING`** events for siblings, then a **`SECTION_REVIEWED_…`** event for the section once.
- **Section “Set to Pending”** (documents): resets every document item in the database but does **not** emit one **`ITEM_REVIEWED_PENDING`** per item (avoids a noisy timeline). A single derived **`SECTION_REVIEWED_PENDING`** (or equivalent) is logged when the section status actually changes after sync.

---

## Summary

- **Section status** = pure function of **all** document item statuses, with **rejection** and **pending** taking precedence, then **all approved**, then **amendment requested** among decided items.
- **No** section-level approve/reject/amendment for documents in the API.
- **Rejecting one document** clears **sibling amendment drafts** and **resets sibling `AMENDMENT_REQUESTED`** items to **pending**, then re-syncs the section.
- **UI** hides bulk section actions and **locks** primary row actions while **any** document remains **rejected**, until reviewers clear state via **Set to Pending** (item or section).
