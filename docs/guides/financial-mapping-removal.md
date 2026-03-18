# Financial Mapping Removal Guide

Remove the financial to financial_statements mapping. Pick one canonical name and use it everywhere.


ADMIN PORTAL

apps/admin/src/app/applications/[productKey]/[id]/page.tsx
  Line 210: Remove this line if (set.has("financial_statements") && !set.has("financial")) set.add("financial");
  Line 217: Change d.reviewSection === "financial" && visibleReviewSectionsFromApi.has("financial_statements") to use same name both sides
  Line 154, 986: Change section: "financial" to section: "financial_statements" if standardizing on financial_statements

apps/admin/src/components/application-review/review-registry.ts
  Line 61-62: Change "financial" in arrays to "financial_statements"
  Line 80-83: Change id, label, reviewSection, kind from "financial" to "financial_statements"

apps/admin/src/components/application-review/section-content.tsx
  Line 139: Change case "financial": to case "financial_statements":

apps/admin/src/components/application-review-tabs.tsx
  Line 52: Change "financial" default to "financial_statements"


ISSUER PORTAL

apps/issuer/src/app/(application-flow)/applications/edit/[id]/page.tsx
  Line 262: Change const key = rem.scope_key === "financial" ? "financial_statements" : rem.scope_key; to const key = rem.scope_key;
  Line 277: Change const tabKey = tab === "financial" ? "financial_statements" : tab; to const tabKey = tab;
  Line 713: Change r.scope_key === "financial" && currentStepKey === "financial_statements" to use same name both sides
  Line 415, 758, 1062: If standardizing on financial change "financial_statements" to "financial"


API

apps/api/src/modules/applications/amendments/service.ts
  Line 36-37: Change const scopeKeyToField = (key: string) => (key === "financial" ? "financial_statements" : key); to const scopeKeyToField = (key: string) => key;


CANONICAL NAME

Use financial_statements if the DB and API already use it.
Use financial if admin prefers shorter names.
After choosing update all references in both portals and API to use that single name.
