"use client";

import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/app/(application-flow)/applications/components/date-input";
import { FileUploadArea } from "@/app/(application-flow)/applications/components/file-upload-area";
import {
  applicationFlowAmendmentTargetSurfaceClassName,
  applicationFlowLabelCellAlignInputClassName,
  applicationFlowLabelCellAlignTopClassName,
  fieldLabelWithTooltipRowClassName,
  fieldTooltipContentClassName,
  fieldTooltipTriggerClassName,
  formInputClassName,
  formInputDisabledClassName,
  formLabelClassName,
  formSelectTriggerClassName,
  withFieldError,
} from "@/app/(application-flow)/applications/components/form-control";
import { cn } from "@/lib/utils";
import { formatMoney, parseMoney } from "@cashsouk/ui";
import { MoneyInput, Slider } from "@cashsouk/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FINANCING_TENURE_DAYS_OPTIONS,
  FINANCING_TENURE_MAX_DAYS,
  formatFinancingTenureDaysLabel,
  malaysiaCalendarDaysRemaining,
  validateFinancingTenureAgainstDueDate,
  type WithdrawReason,
} from "@cashsouk/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type InvoiceFormModel = {
  id: string;
  isPersisted: boolean;
  number: string;
  value: string;
  maturity_date: string;
  financing_tenure_days?: number;
  financing_ratio_percent?: number;
  status?: string;
  withdraw_reason?: WithdrawReason;
  document?: { file_name: string; file_size?: number; s3_key?: string; uploaded_at?: string } | null;
  displayReference?: string | null;
};

export type InvoiceFieldErrors = Partial<{
  number: string;
  maturity_date: string;
  financing_tenure_days: string;
  value: string;
  financing_ratio_percent: string;
  financing_amount: string;
  document: string;
}>;

const sectionGridClassName =
  "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3 items-start";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-ui text-destructive">{message}</p>;
}

function LabelWithTooltip({
  htmlFor,
  label,
  tooltip,
  alignTop,
}: {
  htmlFor?: string;
  label: string;
  tooltip?: string;
  alignTop?: boolean;
}) {
  const labelClass = cn(
    formLabelClassName,
    "font-normal",
    alignTop ? applicationFlowLabelCellAlignTopClassName : applicationFlowLabelCellAlignInputClassName
  );
  if (!tooltip) {
    return (
      <Label htmlFor={htmlFor} className={labelClass}>
        {label}
      </Label>
    );
  }
  return (
    <div className={fieldLabelWithTooltipRowClassName}>
      <Label htmlFor={htmlFor} className={cn(formLabelClassName, "font-normal")}>
        {label}
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={fieldTooltipTriggerClassName} aria-label={`About ${label}`}>
            <InformationCircleIcon className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function invoiceTabLabel(invoice: Pick<InvoiceFormModel, "isPersisted" | "number" | "displayReference">): string {
  const number = invoice.number.trim();
  if (!invoice.isPersisted && !number) return "New invoice";
  return invoice.displayReference?.trim() || number || "New invoice";
}

export interface InvoiceFormFieldsProps {
  invoice: InvoiceFormModel;
  minRatio: number;
  maxRatio: number;
  isEditable: boolean;
  isAmendmentTarget?: boolean;
  helperText?: string;
  pendingFile?: File;
  fieldErrors?: InvoiceFieldErrors;
  financingAmountDraft?: string;
  onNumberChange?: (value: string) => void;
  onMaturityDateChange?: (value: string) => void;
  onFinancingTenureDaysChange?: (value: number) => void;
  onValueChange?: (value: string) => void;
  onRatioChange?: (value: number) => void;
  onFinancingAmountDraftChange?: (value: string) => void;
  onFinancingAmountCommit?: (formatted: string) => void;
  onFileSelect?: (file: File) => void;
  onRemoveFile?: () => void;
  financingAmountTooltip?: string;
  invoiceValueTooltip?: string;
  invoiceValueHint?: string;
  financingAmountHint?: string;
}

export function InvoiceFormFields({
  invoice,
  minRatio,
  maxRatio,
  isEditable,
  isAmendmentTarget = false,
  helperText,
  pendingFile,
  fieldErrors,
  financingAmountDraft,
  onNumberChange,
  onMaturityDateChange,
  onFinancingTenureDaysChange,
  onValueChange,
  onRatioChange,
  onFinancingAmountDraftChange,
  onFinancingAmountCommit,
  onFileSelect,
  onRemoveFile,
  financingAmountTooltip,
  invoiceValueTooltip,
  invoiceValueHint,
  financingAmountHint,
}: InvoiceFormFieldsProps) {
  const inputClassName = cn(formInputClassName, !isEditable && formInputDisabledClassName);
  const numberId = `invoice-number-${invoice.id}`;
  const maturityId = `invoice-maturity-${invoice.id}`;
  const tenureId = `invoice-tenure-${invoice.id}`;
  const ratioNum =
    invoice.financing_ratio_percent == null
      ? minRatio
      : Math.min(maxRatio, Math.max(minRatio, Math.round(invoice.financing_ratio_percent)));
  const invoiceValue = parseMoney(invoice.value);
  const financingAmount = invoiceValue * (ratioNum / 100);
  const daysUntilDue = invoice.maturity_date
    ? malaysiaCalendarDaysRemaining(new Date(), invoice.maturity_date)
    : null;
  const dueDateCheck = invoice.maturity_date
    ? validateFinancingTenureAgainstDueDate({
        tenureDays: invoice.financing_tenure_days ?? FINANCING_TENURE_MAX_DAYS,
        maturityDate: invoice.maturity_date,
      })
    : null;
  const dueDateTooFarMessage =
    dueDateCheck && !dueDateCheck.ok && dueDateCheck.message.includes("more than")
      ? dueDateCheck.message
      : undefined;
  const tenureCoverageMessage =
    invoice.financing_tenure_days != null &&
    dueDateCheck &&
    !dueDateCheck.ok &&
    dueDateCheck.message.includes("must be at least")
      ? dueDateCheck.message
      : undefined;
  const maturityError = dueDateTooFarMessage || fieldErrors?.maturity_date;
  const tenureError = tenureCoverageMessage || fieldErrors?.financing_tenure_days;
  const canFilterTenureByDueDate =
    daysUntilDue != null && daysUntilDue >= 0 && daysUntilDue <= FINANCING_TENURE_MAX_DAYS;

  const uploadedFile = invoice.document?.file_name
    ? {
        s3_key: invoice.document.s3_key ?? "",
        file_name: invoice.document.file_name,
        file_size: invoice.document.file_size,
        uploaded_at: invoice.document.uploaded_at,
      }
    : null;

  return (
    <div
      className={cn(
        "space-y-3",
        isAmendmentTarget && cn("rounded-xl p-3", applicationFlowAmendmentTargetSurfaceClassName)
      )}
    >
      {helperText ? <p className="px-3 text-sm text-muted-foreground">{helperText}</p> : null}
      <div className={sectionGridClassName}>
        <LabelWithTooltip htmlFor={numberId} label="Invoice number" />
        <div className="space-y-1">
          <Input
            id={numberId}
            value={invoice.number}
            disabled={!isEditable}
            onChange={(e) => onNumberChange?.(e.target.value)}
            placeholder="Enter invoice number"
            className={withFieldError(inputClassName, Boolean(fieldErrors?.number))}
          />
          <FieldError message={fieldErrors?.number} />
        </div>

        <LabelWithTooltip
          htmlFor={maturityId}
          label="Maturity date"
          tooltip="Invoice maturity date is the deadline when your customer is required to pay for this invoice. For example, if your invoice date is 1st of January, and your payment term is 60 days, the maturity date is 1st of March."
        />
        <div className="space-y-1">
          <DateInput
            id={maturityId}
            value={invoice.maturity_date || ""}
            onChange={(v) => onMaturityDateChange?.(v)}
            disabled={!isEditable}
            isInvalid={Boolean(maturityError)}
            placeholder="Enter date"
            className={inputClassName}
          />
          <p className="text-meta text-muted-foreground">
            Must be within {FINANCING_TENURE_MAX_DAYS} days from today.
          </p>
          <FieldError message={maturityError} />
        </div>

        <LabelWithTooltip
          htmlFor={tenureId}
          label="Financing tenure"
          tooltip="How long you need the financing for. It must cover the time until your customer is due to pay this invoice. The period starts when funds are disbursed."
        />
        <div className="space-y-1">
          <Select
            value={
              invoice.financing_tenure_days != null
                ? String(invoice.financing_tenure_days)
                : undefined
            }
            onValueChange={(value) => onFinancingTenureDaysChange?.(Number(value))}
            disabled={!isEditable}
          >
            <SelectTrigger
              id={tenureId}
              aria-label="Financing tenure"
              className={withFieldError(
                cn(formSelectTriggerClassName, !isEditable && formInputDisabledClassName),
                Boolean(tenureError)
              )}
            >
              <SelectValue placeholder="Select tenure" />
            </SelectTrigger>
            <SelectContent className="max-h-[240px]">
              {FINANCING_TENURE_DAYS_OPTIONS.map((days) => (
                <SelectItem
                  key={days}
                  value={String(days)}
                  disabled={
                    daysUntilDue != null && canFilterTenureByDueDate && days < daysUntilDue
                  }
                >
                  {formatFinancingTenureDaysLabel(days)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={tenureError} />
        </div>

        <LabelWithTooltip label="Invoice value" tooltip={invoiceValueTooltip} />
        <div className="space-y-1">
          <MoneyInput
            value={invoice.value}
            onValueChange={(v) => onValueChange?.(v)}
            placeholder="0.00"
            prefix="RM"
            disabled={!isEditable}
            inputClassName={withFieldError(inputClassName, Boolean(fieldErrors?.value))}
          />
          {invoiceValueHint ? (
            <p className="text-meta text-muted-foreground">{invoiceValueHint}</p>
          ) : null}
          <FieldError message={fieldErrors?.value} />
        </div>

        <LabelWithTooltip
          label="Financing ratio"
          tooltip={`Allowed ratio: ${minRatio}%–${maxRatio}%. If you edit the financing amount, the ratio will round up and stay within this range.`}
        />
        <div className="space-y-1">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                formInputClassName,
                "flex w-[4.75rem] shrink-0 items-center justify-center tabular-nums font-medium",
                !isEditable && formInputDisabledClassName
              )}
            >
              {ratioNum}%
            </div>
            <div className="min-w-0 flex-1 max-w-xs">
              <Slider
                min={minRatio}
                max={maxRatio}
                step={1}
                value={[ratioNum]}
                disabled={!isEditable}
                onValueChange={(value) => onRatioChange?.(Math.round(value[0]))}
                className={cn(
                  "relative w-full max-w-full",
                  !isEditable &&
                    "opacity-100 [&_[data-disabled]]:opacity-100 [&_.relative.h-2]:bg-muted [&_span.absolute]:bg-muted-foreground/50 [&_button]:border-muted-foreground/50 [&_button]:bg-muted"
                )}
              />
              <div className="mt-0.5 flex justify-between text-meta font-medium text-muted-foreground tabular-nums">
                <span>{minRatio}%</span>
                <span>{maxRatio}%</span>
              </div>
            </div>
          </div>
          <FieldError message={fieldErrors?.financing_ratio_percent} />
        </div>

        <LabelWithTooltip
          label="Financing amount"
          tooltip={
            financingAmountTooltip ??
            [
              "Financing amount is calculated from the invoice value and financing ratio.",
              "If you edit this amount, the financing ratio will update automatically.",
            ].join("\n\n")
          }
        />
        <div className="space-y-1">
          <MoneyInput
            value={financingAmountDraft ?? (financingAmount > 0 ? formatMoney(financingAmount) : "")}
            onValueChange={(v) => onFinancingAmountDraftChange?.(v)}
            onBlurComplete={(formatted) => onFinancingAmountCommit?.(formatted)}
            placeholder="0.00"
            prefix="RM"
            disabled={!isEditable || invoiceValue <= 0}
            inputClassName={cn(
              withFieldError(formInputClassName, Boolean(fieldErrors?.financing_amount)),
              (!isEditable || invoiceValue <= 0) && formInputDisabledClassName
            )}
          />
          <p className="text-meta text-muted-foreground tabular-nums">Based on {ratioNum}% ratio</p>
          {financingAmountHint ? (
            <p className="text-meta text-muted-foreground">{financingAmountHint}</p>
          ) : null}
          <FieldError message={fieldErrors?.financing_amount} />
        </div>

        <LabelWithTooltip htmlFor={`invoice-document-${invoice.id}`} label="Document" alignTop />
        <div className="space-y-1 self-start">
          <FileUploadArea
            onFileSelect={(file) => onFileSelect?.(file)}
            uploadedFile={pendingFile ? null : uploadedFile}
            pendingFile={pendingFile}
            onRemove={isEditable ? onRemoveFile : undefined}
            disabled={!isEditable}
          />
          <FieldError message={fieldErrors?.document} />
        </div>
      </div>
    </div>
  );
}
