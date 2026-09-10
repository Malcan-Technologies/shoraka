"use client";

import {
  ISSUER_PROFILE_BALANCE_SHEET_KEYS,
  ISSUER_PROFILE_PNL_KEYS,
  firstIssueMessage,
  formatProfileRmAmount,
  isIssuerFinancialFieldRequired,
  issuesByField,
  profileFinancialFieldLabel,
  PROFILE_FINANCIAL_FIELD_HELP,
  validateIssuerFinancialFields,
} from "@cashsouk/types";
import { Button } from "./components/button";
import { Input } from "./components/input";
import { ComRepFieldLabel } from "./comrep-field-label";
import { ProfileFieldGrid, ProfileReadField } from "./components/profile-read-field";
import { StatusBadge } from "./components/status-badge";
import { cn } from "./lib/utils";

const EDITABLE_KEYS = [...ISSUER_PROFILE_BALANCE_SHEET_KEYS, ...ISSUER_PROFILE_PNL_KEYS] as const;

export function profileFinancialDraftFromValues(values: Record<string, unknown> | null | undefined): Record<string, string> {
  const next: Record<string, string> = {};
  for (const key of EDITABLE_KEYS) {
    const current = values?.[key];
    next[key] = current == null ? "" : String(current);
  }
  return next;
}

function FinancialAmountFields({
  keys,
  values,
  isEditing,
  draft,
  fieldErrors,
  onDraftChange,
}: {
  keys: readonly string[];
  values: Record<string, unknown> | null | undefined;
  isEditing: boolean;
  draft: Record<string, string>;
  fieldErrors: Record<string, string>;
  onDraftChange: (key: string, value: string) => void;
}) {
  if (isEditing) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {keys.map((key) => {
          const required = isIssuerFinancialFieldRequired(key);
          const error = fieldErrors[key];
          return (
            <div key={key} className="space-y-2">
              <ComRepFieldLabel
                htmlFor={`profile-financial-${key}`}
                label={profileFinancialFieldLabel(key, true)}
                required={required}
                optional={!required}
                help={PROFILE_FINANCIAL_FIELD_HELP[key]}
              />
              <Input
                id={`profile-financial-${key}`}
                className="h-11 text-ui"
                inputMode="decimal"
                value={draft[key] ?? ""}
                aria-required={required}
                aria-invalid={Boolean(error)}
                onChange={(event) => onDraftChange(key, event.target.value)}
              />
              {error ? <p className="text-meta text-destructive">{error}</p> : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <ProfileFieldGrid>
      {keys.map((key) => (
        <ProfileReadField
          key={key}
          label={profileFinancialFieldLabel(key)}
          value={formatProfileRmAmount(values?.[key])}
        />
      ))}
    </ProfileFieldGrid>
  );
}

export function ProfileFinancialStatementsBody({
  yearLabel,
  values,
  isEditing,
  draft,
  fieldErrors,
  missingCount,
  complete,
  onDraftChange,
}: {
  yearLabel: string | null;
  values: Record<string, unknown> | null | undefined;
  isEditing: boolean;
  draft: Record<string, string>;
  fieldErrors: Record<string, string>;
  missingCount: number;
  complete: boolean;
  onDraftChange: (key: string, value: string) => void;
}) {
  const statusLabel = complete
    ? "Complete"
    : missingCount
      ? `${missingCount} required ${missingCount === 1 ? "field" : "fields"} missing`
      : "Missing fields";

  return (
    <div className="space-y-6">
      <ProfileFieldGrid>
        <ProfileReadField label="Financial Year" value={yearLabel ?? "—"} />
        <ProfileReadField
          label="Status"
          value={<StatusBadge status={complete ? "success" : "action"} label={statusLabel} />}
        />
      </ProfileFieldGrid>
      <div className="space-y-3">
        <h3 className="text-card-title">Balance Sheet</h3>
        {values || isEditing ? (
          <FinancialAmountFields
            keys={ISSUER_PROFILE_BALANCE_SHEET_KEYS}
            values={values}
            isEditing={isEditing}
            draft={draft}
            fieldErrors={fieldErrors}
            onDraftChange={onDraftChange}
          />
        ) : (
          <p className="text-ui text-muted-foreground">No financial statements have been added yet.</p>
        )}
      </div>
      {values || isEditing ? (
        <div className="space-y-3">
          <h3 className="text-card-title">Profit and Loss</h3>
          <FinancialAmountFields
            keys={ISSUER_PROFILE_PNL_KEYS}
            values={values}
            isEditing={isEditing}
            draft={draft}
            fieldErrors={fieldErrors}
            onDraftChange={onDraftChange}
          />
        </div>
      ) : null}
    </div>
  );
}

export function ProfileFinancialSaveBar({
  isSaving,
  onCancel,
  onSave,
  className,
}: {
  isSaving: boolean;
  onCancel: () => void;
  onSave: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-end gap-2 pt-2", className)}>
      <Button type="button" variant="outline" className="h-10" onClick={onCancel} disabled={isSaving}>
        Cancel
      </Button>
      <Button type="button" className="h-10" onClick={onSave} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save changes"}
      </Button>
    </div>
  );
}

export function validateProfileFinancialDraft(draft: Record<string, string>) {
  const fields: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(draft)) {
    fields[key] = value.trim() === "" ? null : value.trim();
  }
  const issues = validateIssuerFinancialFields(fields);
  return {
    fields,
    issues,
    fieldErrors: issuesByField(issues),
    firstMessage: firstIssueMessage(issues) ?? "Complete the required financial fields.",
  };
}
