"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeSigningIcNumber, type AuthorizedRepresentativeCapacity } from "@cashsouk/types";
import { EMPTY_CORPORATE_REP, type CorporateRepDraft } from "./guarantor-authorized-parties";

type CorporateGuarantorRepresentativesCardProps = {
  entityId: string;
  companyName: string;
  representatives: CorporateRepDraft[];
  onChange: (representatives: CorporateRepDraft[]) => void;
  readOnly?: boolean;
};

const CAPACITY_OPTIONS: Array<{ value: AuthorizedRepresentativeCapacity; label: string }> = [
  { value: "authorised_signatory", label: "Authorised signatory" },
  { value: "director", label: "Director" },
];

export function CorporateGuarantorRepresentativesCard({
  entityId,
  companyName,
  representatives,
  onChange,
  readOnly = false,
}: CorporateGuarantorRepresentativesCardProps) {
  const rows = representatives.length > 0 ? representatives : [{ ...EMPTY_CORPORATE_REP }];

  const updateRow = (index: number, patch: Partial<CorporateRepDraft>) => {
    const next = rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, rowIndex) => rowIndex !== index);
    onChange(next.length > 0 ? next : [{ ...EMPTY_CORPORATE_REP }]);
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-3">
      <div className="min-w-0">
        <p className="text-card-title text-foreground">{companyName}</p>
        <p className="mt-1 text-meta text-muted-foreground">
          Name the people who may represent this company. CashSouk will review this list with the
          Board Resolution.
        </p>
      </div>
      <div className="space-y-3">
        {rows.map((row, index) => {
          const nameFieldId = `corporate-rep-name-${entityId}-${index}`;
          const emailFieldId = `corporate-rep-email-${entityId}-${index}`;
          const icFieldId = `corporate-rep-ic-${entityId}-${index}`;
          const capacityFieldId = `corporate-rep-capacity-${entityId}-${index}`;
          return (
            <div key={`${index}`} className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
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
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={icFieldId} className="text-meta text-muted-foreground">
                    MyKad number
                  </Label>
                  <Input
                    id={icFieldId}
                    inputMode="numeric"
                    value={row.ic_number}
                    disabled={readOnly}
                    onChange={(event) =>
                      updateRow(index, {
                        ic_number: normalizeSigningIcNumber(event.target.value).slice(0, 12),
                      })
                    }
                    placeholder="12 digits"
                    className="rounded-xl text-ui"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={capacityFieldId} className="text-meta text-muted-foreground">
                    Capacity
                  </Label>
                  <Select
                    value={row.capacity}
                    disabled={readOnly}
                    onValueChange={(value) =>
                      updateRow(index, { capacity: value as AuthorizedRepresentativeCapacity })
                    }
                  >
                    <SelectTrigger id={capacityFieldId} className="rounded-xl text-ui">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAPACITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
