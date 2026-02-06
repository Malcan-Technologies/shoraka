# How to add a new product workflow step

This guide explains how to add a new step to the product workflow in the admin app (e.g. a step called “Terms and Conditions”). You touch a few files; the steps below list them and what to do.

---

## 1. Tell the app the step exists (types)

**File:** `packages/types/src/application-steps.ts`

- Add your step key to the list `APPLICATION_STEP_KEYS`. The order here is the default order in the workflow.

Example: add `"terms_and_conditions"` before `"review_and_submit"`.

- Add a label for it in `STEP_KEY_DISPLAY`. You need `title` and `description`. The **title** is what shows on the card. Description can be `""` if you don't need it.

Example:

```ts
terms_and_conditions: {
  title: "Terms and Conditions",
  description: "",
},
```

Save the file. The type updates by itself.

---

## 2. Does this step have a form or not?

- **No form** – The step is just a card. When you expand it, there’s nothing to fill in. → Do step 3a only.
- **Has a form** – When you expand the card, the admin can edit something. → Do step 3b and step 4.

---

## 3a. No form – add to the “no config” list

**File:** `apps/admin/src/app/settings/products/workflow-builder/workflow-registry.tsx`

Find `STEPS_WITHOUT_CONFIG` and add your key, e.g. `"terms_and_conditions"`.

Then you’re done. Skip step 4.

---

## 3b. Has a form – create the form component

**New file:** `apps/admin/src/app/settings/products/workflow-builder/step-configs/terms-and-conditions-config.tsx`

(Use a name that matches your step, e.g. `terms-and-conditions-config.tsx`.)

Minimal version:

```tsx
"use client";

export function TermsAndConditionsConfig({
  config,
  onChange,
}: {
  config: unknown;
  onChange: (config: unknown) => void;
}) {
  return (
    <div className="pt-2 min-w-0 text-sm leading-6">
      {/* Add your inputs here. What you put in config is saved. */}
    </div>
  );
}
```

Add your inputs (e.g. from `@/components/ui/input`). When the user types, call `onChange({ ...config, yourField: value })`. That’s what gets saved.

---

## 4. Register the form in the registry

**File:** `apps/admin/src/app/settings/products/workflow-builder/workflow-registry.tsx`

- At the top: import your component, e.g.  
  `import { TermsAndConditionsConfig } from "./step-configs/terms-and-conditions-config";`
- In `STEP_CONFIG_MAP`, add a line:  
  `terms_and_conditions: TermsAndConditionsConfig,`

Do **not** put this key in `STEPS_WITHOUT_CONFIG`, or the form won’t show.

After this, your step appears in the “Add step” dropdown and the card expands to show your form.

---

## 5. (Optional) Make something required before Save

Only if the step must block Save until a field is filled (like “enter name” for Financing Type).

**File:** `apps/admin/src/app/settings/products/workflow-builder/product-form-helpers.ts`

In the function `getRequiredStepErrors()`, add a block for your step key:

```ts
if (stepKey === "terms_and_conditions") {
  // e.g. if (!config.someField) errors.push(`${stepLabel}: enter some field`);
}
```

The message you push is what appears in the amber alert.

---

## 6. (Optional) Default value when saving

Only if you want a default in the saved JSON (like Invoice Details defaulting a number).

**File:** `apps/admin/src/app/settings/products/workflow-builder/product-form-helpers.ts`

In `buildPayloadFromSteps()`, inside the loop over steps, add something like:

```ts
if (stepKey === "terms_and_conditions" && config.someField === undefined) {
  config = { ...config, someField: "default" };
}
```

---

## Quick checklist

| # | Where | What |
|---|--------|------|
| 1 | `packages/types/src/application-steps.ts` | Add key to list + entry in `STEP_KEY_DISPLAY` (title, description). |
| 2 | You decide | Form or no form? |
| 3a | `workflow-registry.tsx` | No form → add key to `STEPS_WITHOUT_CONFIG`. |
| 3b + 4 | New file + `workflow-registry.tsx` | Form → create `step-configs/your-step-config.tsx`, then import and add to `STEP_CONFIG_MAP`. |
| 5 | `product-form-helpers.ts` | Optional: add validation in `getRequiredStepErrors()`. |
| 6 | `product-form-helpers.ts` | Optional: add default in `buildPayloadFromSteps()`. |

---

## Where does the data go when you click Save?

The dialog builds the workflow (with your step’s `config` in it) and sends it to the API. The API saves that JSON to the database. Whatever you put in `config` in your form is what gets saved.

---

**See also:** Settings Products overview – **docs/settings-products.md** (what the Products page does, required fields, API, and where the code lives).
