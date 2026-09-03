"use client";

import * as React from "react";
import {
  ABOUT_YOUR_BUSINESS_LIMITS,
  parseAboutYourBusiness,
  type AboutYourBusiness,
} from "@cashsouk/types";
import { BriefcaseIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { KeyValueGrid } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TextareaWithCharCount } from "@/components/textarea-with-char-count";
import { useCorporateInfo } from "@/hooks/use-corporate-info";
import { cn } from "@/lib/utils";
import {
  formInputClassName,
  formInputDisabledClassName,
  formLabelClassName,
  formTextareaClassName,
} from "@/app/(application-flow)/applications/components/form-control";

interface AboutYourBusinessCardProps {
  organizationId: string;
  canEdit?: boolean;
}

const textareaClassName = cn(formTextareaClassName, "min-h-[100px] resize-y");

function emptyDraft(): AboutYourBusiness {
  return {
    whatDoesCompanyDo: "",
    mainCustomers: "",
    singleCustomerOver50Revenue: null,
    accountingSoftware: "",
  };
}

function YesNoRadio({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: boolean | null;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const labelClass = formLabelClassName;
  const option = (optionValue: boolean, label: string) => {
    const checked = value === optionValue;
    return (
      <label className={cn("flex items-center gap-2", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <input
            type="radio"
            name={name}
            value={optionValue ? "yes" : "no"}
            checked={checked}
            onChange={() => !disabled && onChange(optionValue)}
            disabled={disabled}
            className="sr-only"
          />
          <span
            className={cn(
              "pointer-events-none relative block h-5 w-5 shrink-0 rounded-full",
              checked
                ? disabled
                  ? "border-2 border-muted-foreground/50 bg-muted"
                  : "bg-primary"
                : "border-2 border-muted-foreground/50 bg-muted/30"
            )}
            aria-hidden
          >
            {checked ? (
              <span
                className={cn(
                  "absolute inset-1 rounded-full",
                  disabled ? "bg-muted-foreground/60" : "bg-white"
                )}
                aria-hidden
              />
            ) : (
              <span className="absolute inset-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
            )}
          </span>
        </span>
        <span className={checked ? labelClass : cn(labelClass, "text-muted-foreground")}>{label}</span>
      </label>
    );
  };
  return (
    <div className="flex h-11 items-center gap-6">
      {option(true, "Yes")}
      {option(false, "No")}
    </div>
  );
}

export function AboutYourBusinessCard({
  organizationId,
  canEdit = true,
}: AboutYourBusinessCardProps) {
  const { corporateInfo, isLoading, update, isUpdating } = useCorporateInfo(organizationId);
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<AboutYourBusiness>(emptyDraft);

  React.useEffect(() => {
    setDraft(parseAboutYourBusiness(corporateInfo?.aboutYourBusiness));
  }, [corporateInfo]);

  const handleSave = () => {
    update({
      aboutYourBusiness: {
        whatDoesCompanyDo: draft.whatDoesCompanyDo,
        mainCustomers: draft.mainCustomers,
        singleCustomerOver50Revenue: draft.singleCustomerOver50Revenue,
        accountingSoftware: draft.accountingSoftware,
      },
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(parseAboutYourBusiness(corporateInfo?.aboutYourBusiness));
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card">
        <div className="border-b p-6">
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="space-y-4 p-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  const fieldsLocked = !isEditing;

  return (
    <div id="about-your-business" className="scroll-mt-24 rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b p-6">
        <div className="flex items-center gap-3">
          <BriefcaseIcon className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">About your business</h2>
            <p className="text-sm text-muted-foreground">What the company does and who it serves</p>
          </div>
        </div>
        {!isEditing && canEdit ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="gap-2 rounded-xl"
          >
            <PencilIcon className="h-4 w-4" />
            Edit
          </Button>
        ) : null}
        {isEditing ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel} className="gap-2 rounded-xl">
              <XMarkIcon className="h-4 w-4" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isUpdating} className="rounded-xl">
              {isUpdating ? "Saving..." : "Save"}
            </Button>
          </div>
        ) : null}
      </div>
      {fieldsLocked ? (
        <div className="p-6">
          <KeyValueGrid
            items={[
              {
                label: "What does your company do?",
                value: draft.whatDoesCompanyDo.trim() || "—",
              },
              {
                label: "Who are your main customers?",
                value: draft.mainCustomers.trim() || "—",
              },
              {
                label: "Any single customer over 50% of revenue?",
                value:
                  draft.singleCustomerOver50Revenue === true
                    ? "Yes"
                    : draft.singleCustomerOver50Revenue === false
                      ? "No"
                      : "—",
              },
              {
                label: "Accounting software",
                value: draft.accountingSoftware.trim() || "—",
              },
            ]}
          />
        </div>
      ) : (
      <div className="space-y-6 p-6">
        <div className="space-y-2">
          <Label htmlFor="profile-what-does-company-do" className={formLabelClassName}>
            What does your company do?
          </Label>
          <TextareaWithCharCount
            id="profile-what-does-company-do"
            value={draft.whatDoesCompanyDo}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                whatDoesCompanyDo: e.target.value.slice(0, ABOUT_YOUR_BUSINESS_LIMITS.whatDoesCompanyDo),
              }))
            }
            placeholder="Add details"
            maxLength={ABOUT_YOUR_BUSINESS_LIMITS.whatDoesCompanyDo}
            className={textareaClassName}
            countLabel={`${draft.whatDoesCompanyDo.length}/${ABOUT_YOUR_BUSINESS_LIMITS.whatDoesCompanyDo} characters`}
            disabled={fieldsLocked}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-main-customers" className={formLabelClassName}>
            Who are your main customers?
          </Label>
          <TextareaWithCharCount
            id="profile-main-customers"
            value={draft.mainCustomers}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                mainCustomers: e.target.value.slice(0, ABOUT_YOUR_BUSINESS_LIMITS.mainCustomers),
              }))
            }
            placeholder="Add details"
            maxLength={ABOUT_YOUR_BUSINESS_LIMITS.mainCustomers}
            className={textareaClassName}
            countLabel={`${draft.mainCustomers.length}/${ABOUT_YOUR_BUSINESS_LIMITS.mainCustomers} characters`}
            disabled={fieldsLocked}
          />
        </div>
        <div className="space-y-2">
          <Label className={formLabelClassName}>
            Does any single customer make up more than 50% of your revenue?
          </Label>
          <YesNoRadio
            name="profile-single-customer-over-50"
            value={draft.singleCustomerOver50Revenue}
            onChange={(singleCustomerOver50Revenue) =>
              setDraft((prev) => ({ ...prev, singleCustomerOver50Revenue }))
            }
            disabled={fieldsLocked}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-accounting-software" className={formLabelClassName}>
            Which accounting software does the issuer use?
          </Label>
          <Input
            id="profile-accounting-software"
            value={draft.accountingSoftware}
            onChange={(e) =>
              setDraft((prev) => ({
                ...prev,
                accountingSoftware: e.target.value.slice(0, ABOUT_YOUR_BUSINESS_LIMITS.accountingSoftware),
              }))
            }
            placeholder="e.g. QuickBooks, Xero, SAP"
            maxLength={ABOUT_YOUR_BUSINESS_LIMITS.accountingSoftware}
            disabled={fieldsLocked}
            className={cn(formInputClassName, fieldsLocked && formInputDisabledClassName)}
          />
        </div>
      </div>
      )}
    </div>
  );
}
