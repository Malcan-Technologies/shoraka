"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  allowedScInvestorCategories,
  isAllowedScInvestorCategory,
  PROFILE_HELP,
  PROFILE_LABEL,
  SC_INVESTOR_CATEGORY_DEFINITIONS,
  SC_INVESTOR_CATEGORY_LABELS,
  scInvestorCategoryHelp,
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
  isSophisticatedInvestor: _isSophisticatedInvestor,
  scInvestorCategory,
  isEditing,
  onEdit,
  onCancel,
  onSaveSuccess,
}: {
  organizationId: string;
  organizationType: "PERSONAL" | "COMPANY";
  isSophisticatedInvestor: boolean | null;
  scInvestorCategory?: string | null;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaveSuccess: () => void;
}) {
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const options = allowedScInvestorCategories({ organizationType });

  const requiredCompanyCategory: ScInvestorCategory = "SOPHISTICATED_HIGH_NET_WORTH_ENTITY";
  const currentValid = isAllowedScInvestorCategory(scInvestorCategory, { organizationType });
  const current = currentValid ? (scInvestorCategory as ScInvestorCategory) : "";

  const [value, setValue] = React.useState<string>(current);

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
      if (!isAllowedScInvestorCategory(value, { organizationType })) {
        throw new Error("Please select a valid Type of Investor.");
      }
      const res = await api.patchMasterProfile("investor", organizationId, {
        scInvestorCategory: value as ScInvestorCategory,
      });
      if (!res.success) throw new Error(res.error.message);
      return value;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Investor classification updated");
      onSaveSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const categoryLabel =
    (value && value in SC_INVESTOR_CATEGORY_LABELS
      ? SC_INVESTOR_CATEGORY_LABELS[value as ScInvestorCategory]
      : null) ?? "—";

  const canEditCompany = organizationType === "PERSONAL" ? true : !currentValid;

  return (
    <div id="profile-classification" className="scroll-mt-24 rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b p-6">
        <div>
          <h2 className="text-lg font-semibold">Investor Classification</h2>
          <p className="mt-1 text-ui text-muted-foreground">
            {PROFILE_HELP.typeOfInvestor}
          </p>
        </div>
        {!isEditing ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => {
              if (!canEditCompany) return;
              setValue(
                organizationType === "COMPANY" ? requiredCompanyCategory : (current as string)
              );
              onEdit();
            }}
            disabled={!canEditCompany || save.isPending}
          >
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
        ) : null}
      </div>
      <div className="p-6">
        {isEditing ? (
          <div className="space-y-2">
            <ComRepFieldLabel
              label={PROFILE_LABEL.typeOfInvestor}
              required
              help={options.length > 0 ? scInvestorCategoryHelp(options) : undefined}
            />
            <Select
              value={value || undefined}
              onValueChange={(next) => setValue(next)}
              disabled={save.isPending}
            >
              <SelectTrigger className="h-10 text-ui" aria-label={PROFILE_LABEL.typeOfInvestor}>
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

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setValue(current);
                  onCancel();
                }}
                disabled={save.isPending}
                className="gap-2 rounded-xl"
              >
                <XMarkIcon className="h-4 w-4" />
                Cancel
              </Button>
              <Button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="gap-2 rounded-xl"
              >
                {save.isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        ) : (
          <ProfileFieldGrid>
            <ProfileReadField
              label={PROFILE_LABEL.typeOfInvestor}
              value={
                organizationType === "COMPANY" && !currentValid
                  ? SC_INVESTOR_CATEGORY_LABELS[requiredCompanyCategory]
                  : categoryLabel
              }
              required
              missing={organizationType === "COMPANY" ? !currentValid : !currentValid}
            />
          </ProfileFieldGrid>
        )}
      </div>
    </div>
  );
}
