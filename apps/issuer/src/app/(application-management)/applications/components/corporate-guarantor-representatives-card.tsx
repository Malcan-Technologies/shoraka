"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { applicationFlowAmendmentTargetSurfaceClassName } from "@/app/(application-flow)/applications/components/form-control";
import {
  EMPTY_CORPORATE_REP,
  type CorporateRepDraft,
} from "./guarantor-authorized-parties";
import {
  AuthorizedRepIcField,
  authorizedRepRowGridClass,
  authorizedRepRowGridReadOnlyClass,
} from "./authorized-rep-fields";

type CorporateGuarantorRepresentativesCardProps = {
  entityId: string;
  companyName: string;
  representatives: CorporateRepDraft[];
  onChange: (representatives: CorporateRepDraft[]) => void;
  readOnly?: boolean;
  highlighted?: boolean;
  remark?: string | null;
  embedded?: boolean;
};

export function CorporateGuarantorRepresentativesCard({
  entityId,
  companyName,
  representatives,
  onChange,
  readOnly = false,
  highlighted = false,
  remark = null,
  embedded = false,
}: CorporateGuarantorRepresentativesCardProps) {
  const rows = representatives.length > 0 ? representatives : [{ ...EMPTY_CORPORATE_REP }];

  const updateRow = (index: number, patch: Partial<CorporateRepDraft>) => {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, rowIndex) => rowIndex !== index);
    onChange(next.length > 0 ? next : [{ ...EMPTY_CORPORATE_REP }]);
  };

  return (
    <div
      className={cn(
        "space-y-3",
        embedded ? "rounded-lg p-3" : "rounded-xl bg-background p-3",
        highlighted
          ? applicationFlowAmendmentTargetSurfaceClassName
          : embedded
            ? "bg-muted/40"
            : "border border-border"
      )}
    >
      <div className="min-w-0">
        <p className={embedded ? "text-ui font-medium text-foreground" : "text-card-title text-foreground"}>
          {companyName}
        </p>
        {embedded ? null : (
          <p className="mt-1 text-meta text-muted-foreground">
            Name the people who will represent this company. Everyone named here must sign.
            CashSouk will review this list with the Board Resolution.
          </p>
        )}
        {highlighted ? (
          <p className="mt-2 text-ui text-foreground">
            {remark?.trim() ? remark : "CashSouk requested a change to this list."}
          </p>
        ) : null}
      </div>
      <div className="space-y-3">
        {rows.map((row, index) => {
          const nameFieldId = `corporate-rep-name-${entityId}-${index}`;
          const emailFieldId = `corporate-rep-email-${entityId}-${index}`;
          const icFieldId = `corporate-rep-ic-${entityId}-${index}`;
          return (
            <div
              key={`${index}`}
              className={readOnly ? authorizedRepRowGridReadOnlyClass : authorizedRepRowGridClass}
            >
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor={nameFieldId} className="text-meta text-muted-foreground">
                  Full name
                </Label>
                <Input
                  id={nameFieldId}
                  value={row.name}
                  disabled={readOnly}
                  onChange={(event) => updateRow(index, { name: event.target.value })}
                  placeholder="Full name"
                  className="rounded-xl text-ui"
                />
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor={emailFieldId} className="text-meta text-muted-foreground">
                  Email
                </Label>
                <Input
                  id={emailFieldId}
                  type="email"
                  value={row.email}
                  disabled={readOnly}
                  onChange={(event) => updateRow(index, { email: event.target.value })}
                  placeholder="Email"
                  className="rounded-xl text-ui"
                />
              </div>
              <AuthorizedRepIcField
                id={icFieldId}
                value={row.ic_number}
                readOnly={readOnly}
                onChange={readOnly ? undefined : (value) => updateRow(index, { ic_number: value })}
              />
              {!readOnly ? (
                <div className="flex items-end pb-1">
                  <button
                    type="button"
                    aria-label="Remove representative"
                    disabled={rows.length <= 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-transparent hover:text-destructive disabled:opacity-40"
                    onClick={() => removeRow(index)}
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
        {!readOnly ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl hover:bg-muted hover:text-foreground"
            onClick={() => onChange([...rows, { ...EMPTY_CORPORATE_REP }])}
          >
            Add representative
          </Button>
        ) : null}
      </div>
    </div>
  );
}
