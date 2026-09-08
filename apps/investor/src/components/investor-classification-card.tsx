"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  allowedScInvestorCategories,
  isAllowedScInvestorCategory,
  isSophisticatedInvestorSelected,
  SC_INVESTOR_CATEGORY_DEFINITIONS,
  SC_INVESTOR_CATEGORY_LABELS,
  SC_MONTHLY_INVESTOR,
  scInvestorCategoryAfterSophisticatedChange,
  scInvestorCategoryHelp,
  SELECT_SOPHISTICATED_INVESTOR_FIRST_MESSAGE,
  type ScInvestorCategory,
} from "@cashsouk/types";
import { ComRepFieldLabel } from "@cashsouk/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    setSophisticated(
      isSophisticatedInvestorSelected(isSophisticatedInvestor) ? isSophisticatedInvestor : null
    );
  }, [isSophisticatedInvestor]);

  React.useEffect(() => {
    setValue(current);
  }, [current]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
    await queryClient.invalidateQueries({
      queryKey: ["investor", "profile-completeness", organizationId],
    });
  };

  const saveSophisticated = useMutation({
    mutationFn: async (next: boolean) => {
      const kept = scInvestorCategoryAfterSophisticatedChange(value || scInvestorCategory, {
        organizationType,
        isSophisticatedInvestor: next,
      });
      const res = await api.patchMasterProfile("investor", organizationId, {
        isSophisticatedInvestor: next,
      });
      if (!res.success) throw new Error(res.error.message);
      return kept;
    },
    onSuccess: async (kept) => {
      setValue(kept ?? "");
      await invalidate();
      toast.success("Sophisticated Investor updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveCategory = useMutation({
    mutationFn: async (next: ScInvestorCategory) => {
      const res = await api.patchMasterProfile("investor", organizationId, {
        scInvestorCategory: next,
      });
      if (!res.success) throw new Error(res.error.message);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Type of Investor updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div id="profile-classification" className="scroll-mt-24 rounded-xl border bg-card">
      <div className="border-b p-6">
        <h2 className="text-lg font-semibold">Investor Classification</h2>
        <p className="mt-1 text-ui text-muted-foreground">
          Sophisticated Investor and Type of Investor are required. Type of Investor is used for
          regulatory reporting. It does not change the investor’s product eligibility.
        </p>
      </div>
      <div className="grid gap-6 p-6 sm:grid-cols-2">
        <div className="space-y-2">
          <ComRepFieldLabel label="Sophisticated Investor" required />
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
                    saveSophisticated.mutate(optionValue);
                  }}
                  disabled={saveSophisticated.isPending || saveCategory.isPending}
                  className="h-4 w-4 border-border text-primary focus-visible:ring-ring"
                />
                <span className="text-ui">{optionLabel}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <ComRepFieldLabel
            label={SC_MONTHLY_INVESTOR.typeOfInvestor.label}
            required
            help={options.length > 0 ? scInvestorCategoryHelp(options) : undefined}
          />
          <Select
            value={value || undefined}
            onValueChange={(next) => {
              if (!isAllowedScInvestorCategory(next, categoryScope)) return;
              setValue(next);
              saveCategory.mutate(next);
            }}
            disabled={!sophisticatedChosen || saveSophisticated.isPending || saveCategory.isPending}
          >
            <SelectTrigger
              className="h-10 text-ui"
              aria-label={SC_MONTHLY_INVESTOR.typeOfInvestor.label}
            >
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
      </div>
    </div>
  );
}
