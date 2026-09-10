"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  allowedScInvestorCategories,
  isAllowedScInvestorCategory,
  isSophisticatedInvestorSelected,
  PROFILE_LABEL,
  SC_INVESTOR_CATEGORY_DEFINITIONS,
  SC_INVESTOR_CATEGORY_LABELS,
  scInvestorCategoryAfterSophisticatedChange,
  scInvestorCategoryHelp,
  SELECT_SOPHISTICATED_INVESTOR_FIRST_MESSAGE,
  type ScInvestorCategory,
} from "@cashsouk/types";
import { ComRepFieldLabel, ProfileFieldGrid, ProfileReadField } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function InvestorClassificationCard({
  organizationId,
  organizationType,
  isSophisticatedInvestor,
  scInvestorCategory,
}: {
  organizationId: string;
  organizationType: "PERSONAL" | "COMPANY";
  isSophisticatedInvestor: boolean | null;
  scInvestorCategory?: string | null;
}) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = React.useState(false);
  const [sophisticated, setSophisticated] = React.useState<boolean | null>(
    isSophisticatedInvestorSelected(isSophisticatedInvestor) ? isSophisticatedInvestor : null
  );
  const categoryScope = { organizationType, isSophisticatedInvestor: sophisticated };
  const options = allowedScInvestorCategories(categoryScope);
  const current = isAllowedScInvestorCategory(scInvestorCategory, categoryScope)
    ? scInvestorCategory
    : "";
  const [value, setValue] = React.useState(current);
  const sophisticatedChosen = isSophisticatedInvestorSelected(sophisticated);

  React.useEffect(() => {
    if (isEditing) return;
    setSophisticated(
      isSophisticatedInvestorSelected(isSophisticatedInvestor) ? isSophisticatedInvestor : null
    );
  }, [isEditing, isSophisticatedInvestor]);

  React.useEffect(() => {
    if (isEditing) return;
    setValue(current);
  }, [current, isEditing]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
    await queryClient.invalidateQueries({
      queryKey: ["investor", "profile-completeness", organizationId],
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const nextSophisticated = sophisticated;
      const kept = scInvestorCategoryAfterSophisticatedChange(value || scInvestorCategory, {
        organizationType,
        isSophisticatedInvestor: nextSophisticated,
      });
      const payload: {
        isSophisticatedInvestor?: boolean;
        scInvestorCategory?: ScInvestorCategory;
      } = {};
      if (isSophisticatedInvestorSelected(nextSophisticated)) {
        payload.isSophisticatedInvestor = nextSophisticated;
      }
      const nextCategory = kept ?? value;
      if (isAllowedScInvestorCategory(nextCategory, {
        organizationType,
        isSophisticatedInvestor: nextSophisticated,
      })) {
        payload.scInvestorCategory = nextCategory;
      }
      const res = await api.patchMasterProfile("investor", organizationId, payload);
      if (!res.success) throw new Error(res.error.message);
      return kept;
    },
    onSuccess: async (kept) => {
      setValue(kept ?? value);
      await invalidate();
      toast.success("Investor classification updated");
      setIsEditing(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sophisticatedLabel = sophisticated === true ? "Yes" : sophisticated === false ? "No" : "—";
  const categoryLabel =
    value && value in SC_INVESTOR_CATEGORY_LABELS
      ? SC_INVESTOR_CATEGORY_LABELS[value as ScInvestorCategory]
      : "—";

  return (
    <div id="profile-classification" className="scroll-mt-24 rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b p-6">
        <div>
          <h2 className="text-lg font-semibold">Investor Classification</h2>
          <p className="mt-1 text-ui text-muted-foreground">
            Type of Investor is used for regulatory reporting. It does not change the investor’s
            product eligibility.
          </p>
        </div>
        {!isEditing ? (
          <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => setIsEditing(true)}>
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => {
              setSophisticated(
                isSophisticatedInvestorSelected(isSophisticatedInvestor) ? isSophisticatedInvestor : null
              );
              setValue(current);
              setIsEditing(false);
            }}
            disabled={save.isPending}
          >
            <XMarkIcon className="h-4 w-4" />
            Cancel
          </Button>
        )}
      </div>
      <div className="p-6">
        {isEditing ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <ComRepFieldLabel label={PROFILE_LABEL.sophisticatedInvestor} required />
              <div className="flex min-h-10 items-center gap-6">
                {(
                  [
                    [true, "Yes"],
                    [false, "No"],
                  ] as const
                ).map(([optionValue, optionLabel]) => (
                  <label key={optionLabel} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name={`sophisticated-investor-${organizationId}`}
                      checked={sophisticated === optionValue}
                      onChange={() => {
                        setSophisticated(optionValue);
                        const kept = scInvestorCategoryAfterSophisticatedChange(value, {
                          organizationType,
                          isSophisticatedInvestor: optionValue,
                        });
                        setValue(kept ?? "");
                      }}
                      disabled={save.isPending}
                      className="h-4 w-4 border-border text-primary focus-visible:ring-ring"
                    />
                    <span className="text-ui">{optionLabel}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <ComRepFieldLabel
                label={PROFILE_LABEL.typeOfInvestor}
                required
                help={options.length > 0 ? scInvestorCategoryHelp(options) : undefined}
              />
              <Select
                value={value || undefined}
                onValueChange={(next) => {
                  if (!isAllowedScInvestorCategory(next, categoryScope)) return;
                  setValue(next);
                }}
                disabled={!sophisticatedChosen || save.isPending}
              >
                <SelectTrigger className="h-10 text-ui" aria-label={PROFILE_LABEL.typeOfInvestor}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem
                      key={option}
                      value={option}
                      title={SC_INVESTOR_CATEGORY_DEFINITIONS[option]}
                    >
                      {SC_INVESTOR_CATEGORY_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!sophisticatedChosen ? (
                <p className="text-meta text-muted-foreground">
                  {SELECT_SOPHISTICATED_INVESTOR_FIRST_MESSAGE}
                </p>
              ) : null}
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button className="h-10 rounded-xl" onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        ) : (
          <ProfileFieldGrid>
            <ProfileReadField label={PROFILE_LABEL.sophisticatedInvestor} value={sophisticatedLabel} />
            <ProfileReadField label={PROFILE_LABEL.typeOfInvestor} value={categoryLabel} />
          </ProfileFieldGrid>
        )}
      </div>
    </div>
  );
}
