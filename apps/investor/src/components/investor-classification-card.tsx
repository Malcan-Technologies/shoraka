"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  allowedScInvestorCategories,
  SC_INVESTOR_CATEGORY_DEFINITIONS,
  SC_INVESTOR_CATEGORY_LABELS,
  SC_MONTHLY_INVESTOR,
  isAllowedScInvestorCategory,
  scInvestorCategoryHelp,
  type ScInvestorCategory,
} from "@cashsouk/types";
import { ComRepFieldLabel, ProfileReadField } from "@cashsouk/ui";
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
  isSophisticatedInvestor: boolean;
  scInvestorCategory?: string | null;
}) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const categoryScope = { organizationType, isSophisticatedInvestor };
  const options = allowedScInvestorCategories(categoryScope);
  const current = isAllowedScInvestorCategory(scInvestorCategory, categoryScope)
    ? scInvestorCategory
    : "";
  const [value, setValue] = React.useState(current);

  React.useEffect(() => {
    setValue(current);
  }, [current]);

  const save = useMutation({
    mutationFn: async (next: ScInvestorCategory) => {
      const res = await api.patchMasterProfile("investor", organizationId, {
        scInvestorCategory: next,
      });
      if (!res.success) throw new Error(res.error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      await queryClient.invalidateQueries({
        queryKey: ["investor", "profile-completeness", organizationId],
      });
      toast.success("Type of Investor updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div id="profile-classification" className="scroll-mt-24 rounded-xl border bg-card">
      <div className="border-b p-6">
        <h2 className="text-lg font-semibold">Investor Classification</h2>
        <p className="mt-1 text-ui text-muted-foreground">
          Sophisticated Investor is the existing Yes/No status. Type of Investor is used for
          regulatory reporting. It does not change the investor’s product eligibility.
        </p>
      </div>
      <div className="grid gap-6 p-6 sm:grid-cols-2">
        <ProfileReadField
          label="Sophisticated Investor"
          value={isSophisticatedInvestor ? "Yes" : "No"}
          locked
        />
        <div className="space-y-2">
          <ComRepFieldLabel
            label={SC_MONTHLY_INVESTOR.typeOfInvestor.label}
            required
            help={scInvestorCategoryHelp(options)}
          />
          <Select
            value={value || undefined}
            onValueChange={(next) => {
              if (!isAllowedScInvestorCategory(next, categoryScope)) return;
              setValue(next);
              save.mutate(next);
            }}
            disabled={save.isPending}
          >
            <SelectTrigger className="h-10 text-ui" aria-label={SC_MONTHLY_INVESTOR.typeOfInvestor.label}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={option} title={SC_INVESTOR_CATEGORY_DEFINITIONS[option]}>
                  {SC_INVESTOR_CATEGORY_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
