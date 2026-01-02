"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@cashsouk/ui";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  useOrganizationDetail,
  useUpdateSophisticatedStatus,
} from "@/hooks/use-organization-detail";
import type { PortalType } from "@cashsouk/types";
import { format } from "date-fns";
import {
  UserIcon,
  BuildingOffice2Icon,
  PhoneIcon,
  IdentificationIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
  BanknotesIcon,
  ShieldCheckIcon,
  FaceSmileIcon,
  ArrowTopRightOnSquareIcon,
  LinkIcon,
  ClipboardIcon,
  ClipboardDocumentCheckIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { toast } from "sonner";

interface OrganizationDetailDialogProps {
  portal: PortalType | null;
  organizationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && (
        <div className="flex h-5 w-5 items-center justify-center text-muted-foreground shrink-0 mt-0.5">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

function CopyableField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const [copied, setCopied] = React.useState(false);

  if (!value) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="flex items-start gap-3 py-2">
      {Icon && (
        <div className="flex h-5 w-5 items-center justify-center text-muted-foreground shrink-0 mt-0.5">
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-background hover:bg-muted px-2 py-1 rounded border transition-colors cursor-pointer group mt-0.5"
          title="Click to copy"
        >
          <span className="break-words text-left">{value}</span>
          {copied ? (
            <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
          ) : (
            <ClipboardIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          )}
        </button>
      </div>
    </div>
  );
}

// Helper to check if a string is a URL
function isUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Helper to shorten a URL for display
function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Get last part of pathname (e.g., filename)
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1] || "";
    // Truncate if too long
    if (lastPart.length > 30) {
      return `${parsed.hostname}/.../${lastPart.substring(0, 25)}...`;
    }
    if (pathParts.length > 2) {
      return `${parsed.hostname}/.../${lastPart}`;
    }
    return `${parsed.hostname}${parsed.pathname.substring(0, 40)}${parsed.pathname.length > 40 ? "..." : ""}`;
  } catch {
    return url.substring(0, 40) + (url.length > 40 ? "..." : "");
  }
}

// Type for form field data from RegTank
interface FormField {
  fieldName: string;
  fieldType: string;
  fieldValue: string | boolean | string[] | null;
  alias?: string;
  cn?: boolean;
}

interface FormData {
  content?: FormField[];
  displayArea?: string;
}

// Check if data is a form data structure (has content array with fieldName/fieldValue)
function isFormData(data: unknown): data is FormData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.content) &&
    obj.content.length > 0 &&
    obj.content.every(
      (item: unknown) => typeof item === "object" && item !== null && "fieldName" in item
    )
  );
}

// Fields that should be copyable (by fieldName pattern)
const COPYABLE_FIELD_PATTERNS = [
  /bank.*account.*number/i,
  /account.*number/i,
  /phone/i,
  /mobile/i,
  /email/i,
];

function isCopyableField(fieldName: string): boolean {
  return COPYABLE_FIELD_PATTERNS.some((pattern) => pattern.test(fieldName));
}

// Copyable value component for form fields
function CopyableFormValue({ value, fieldName }: { value: string; fieldName: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${fieldName} copied to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Failed to copy`);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 font-medium bg-background hover:bg-muted px-2 py-1 rounded border transition-colors cursor-pointer group"
      title="Click to copy"
    >
      <span>{value}</span>
      {copied ? (
        <ClipboardDocumentCheckIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
      ) : (
        <ClipboardIcon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
      )}
    </button>
  );
}

// Render form field value based on type
function FormFieldValue({ field }: { field: FormField }): React.ReactNode {
  const { fieldValue, fieldType, fieldName } = field;

  if (fieldValue === null || fieldValue === undefined || fieldValue === "") {
    return <span className="text-muted-foreground">-</span>;
  }

  if (fieldType === "checkbox" && typeof fieldValue === "boolean") {
    return fieldValue ? (
      <span className="text-green-600 font-medium">✓ Yes</span>
    ) : (
      <span className="text-muted-foreground">No</span>
    );
  }

  if (fieldType === "multi-checkbox" && Array.isArray(fieldValue)) {
    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {fieldValue.map((item, idx) => (
          <Badge key={idx} variant="secondary" className="text-xs">
            {item}
          </Badge>
        ))}
      </div>
    );
  }

  // Handle picklist Yes/No values with visual feedback
  if (fieldType === "picklist" && typeof fieldValue === "string") {
    const lowerValue = fieldValue.toLowerCase();
    if (lowerValue === "yes") {
      return <span className="text-green-600 font-medium">✓ Yes</span>;
    }
    if (lowerValue === "no") {
      return <span className="text-muted-foreground">No</span>;
    }
    // For other picklist values, show as badge
    return (
      <Badge variant="secondary" className="text-xs font-medium">
        {fieldValue}
      </Badge>
    );
  }

  if (typeof fieldValue === "string" && isUrl(fieldValue)) {
    return (
      <a
        href={fieldValue}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-primary hover:underline"
      >
        <LinkIcon className="h-3 w-3" />
        <span className="truncate max-w-[200px]">{shortenUrl(fieldValue)}</span>
        <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0" />
      </a>
    );
  }

  // Check if this field should be copyable
  if (typeof fieldValue === "string" && isCopyableField(fieldName)) {
    return <CopyableFormValue value={fieldValue} fieldName={field.alias || fieldName} />;
  }

  return <span className="font-medium">{String(fieldValue)}</span>;
}

// Check if a field is a sophisticated investor criteria field
function isSophisticatedInvestorCriteriaField(fieldName: string, alias?: string): boolean {
  const name = (fieldName || "").toLowerCase();
  const aliasLower = (alias || "").toLowerCase();

  return (
    name.includes("net assets") ||
    aliasLower.includes("net assets") ||
    name.includes("annual income") ||
    aliasLower.includes("annual income") ||
    name.includes("net personal investment portfolio") ||
    name.includes("net joint investment portfolio") ||
    name.includes("rm1,000,000") ||
    name.includes("professional qualification") ||
    aliasLower.includes("professional qualification") ||
    name.includes("experience categories") ||
    aliasLower.includes("experience categories")
  );
}

// Display form data with proper formatting
function FormDataDisplay({ data, label }: { data: FormData; label: React.ReactNode }) {
  const fields = data.content || [];
  const displayArea = data.displayArea || "";
  const isComplianceDeclaration = displayArea.toLowerCase().includes("compliance");

  // Filter out empty header-only fields and group by sections
  const visibleFields = fields.filter((field) => {
    // Keep headers that have meaningful content (not just whitespace)
    if (field.fieldType === "header") {
      return field.fieldName.trim().length > 0;
    }
    return true;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {isComplianceDeclaration && (
          <p className="text-xs text-muted-foreground mt-1">
            Fields marked with a star (★) are used to determine sophisticated investor status.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-1">
        {visibleFields.map((field, idx) => {
          // Render headers as section dividers
          if (field.fieldType === "header") {
            const isSection =
              field.fieldName.endsWith(":") ||
              field.fieldName.includes("Declaration") ||
              field.fieldName.includes("Categories") ||
              field.fieldName.includes("Status");
            return (
              <div
                key={idx}
                className={
                  isSection
                    ? "text-xs font-semibold text-foreground pt-3 pb-1 border-t first:border-0 first:pt-0"
                    : "text-xs text-muted-foreground pl-2"
                }
              >
                {field.fieldName}
              </div>
            );
          }

          // Use alias if available for cleaner display
          const displayName = field.alias || field.fieldName;
          const isCriteriaField =
            isComplianceDeclaration &&
            isSophisticatedInvestorCriteriaField(field.fieldName, field.alias);

          return (
            <div
              key={idx}
              className={`flex flex-col py-1.5 border-b last:border-0 ${isCriteriaField ? "bg-violet-50 dark:bg-violet-950/20 -mx-4 px-4 rounded" : ""}`}
            >
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {isCriteriaField && <span className="text-violet-500">★</span>}
                {displayName}
              </div>
              <div className="text-sm">
                <FormFieldValue field={field} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// KYC Response display component
function KycResponseDisplay({
  data,
}: {
  data: {
    tags?: string[];
    status?: string;
    assignee?: string;
    systemId?: string;
    requestId?: string;
    riskLevel?: string;
    riskScore?: string;
    timestamp?: string;
    referenceId?: string;
    onboardingId?: string;
    messageStatus?: string;
    possibleMatchCount?: number;
    blacklistedMatchCount?: number;
  } | null;
}) {
  if (!data) {
    return null;
  }

  const getRiskLevelColor = (riskLevel: string | undefined) => {
    if (!riskLevel) return "bg-muted text-muted-foreground";
    const level = riskLevel.toLowerCase();
    if (level.includes("low"))
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (level.includes("medium"))
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    if (level.includes("high"))
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    return "bg-muted text-muted-foreground";
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return "bg-muted text-muted-foreground";
    const s = status.toLowerCase();
    if (s === "approved")
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    if (s === "rejected") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    if (s.includes("pending"))
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
    return "bg-muted text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ShieldExclamationIcon className="h-4 w-4" />
          KYC/AML Screening Result
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status and Risk Level Row */}
        <div className="flex flex-wrap gap-3">
          {data.status && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <Badge className={getStatusColor(data.status)}>{data.status}</Badge>
            </div>
          )}
          {data.riskLevel && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Risk Level:</span>
              <Badge className={getRiskLevelColor(data.riskLevel)}>{data.riskLevel}</Badge>
            </div>
          )}
          {data.riskScore && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Risk Score:</span>
              <Badge variant="outline">{data.riskScore}</Badge>
            </div>
          )}
        </div>

        {/* Match Counts */}
        {(data.possibleMatchCount !== undefined || data.blacklistedMatchCount !== undefined) && (
          <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-muted/50">
            {data.possibleMatchCount !== undefined && (
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon
                  className={`h-4 w-4 ${data.possibleMatchCount > 0 ? "text-amber-500" : "text-muted-foreground"}`}
                />
                <span className="text-sm">
                  <span className="font-medium">{data.possibleMatchCount}</span>{" "}
                  <span className="text-muted-foreground">
                    possible {data.possibleMatchCount === 1 ? "match" : "matches"}
                  </span>
                </span>
              </div>
            )}
            {data.blacklistedMatchCount !== undefined && (
              <div className="flex items-center gap-2">
                <ShieldExclamationIcon
                  className={`h-4 w-4 ${data.blacklistedMatchCount > 0 ? "text-red-500" : "text-muted-foreground"}`}
                />
                <span className="text-sm">
                  <span className="font-medium">{data.blacklistedMatchCount}</span>{" "}
                  <span className="text-muted-foreground">
                    blacklisted {data.blacklistedMatchCount === 1 ? "match" : "matches"}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {data.systemId && (
            <div>
              <div className="text-xs text-muted-foreground">System ID</div>
              <div className="font-mono">{data.systemId}</div>
            </div>
          )}
          {data.requestId && (
            <div>
              <div className="text-xs text-muted-foreground">Request ID</div>
              <div className="font-mono">{data.requestId}</div>
            </div>
          )}
          {data.onboardingId && (
            <div>
              <div className="text-xs text-muted-foreground">Onboarding ID</div>
              <div className="font-mono">{data.onboardingId}</div>
            </div>
          )}
          {data.messageStatus && (
            <div>
              <div className="text-xs text-muted-foreground">Message Status</div>
              <div>{data.messageStatus}</div>
            </div>
          )}
          {data.timestamp && (
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground">Screening Date</div>
              <div>{format(new Date(data.timestamp), "PPpp")}</div>
            </div>
          )}
        </div>

        {/* Tags */}
        {data.tags && data.tags.length > 0 && (
          <div>
            <div className="text-xs text-muted-foreground mb-2">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {data.tags.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JsonDisplay({
  data,
  label,
}: {
  data: Record<string, unknown> | null;
  label: React.ReactNode;
}) {
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  // Check if this is form data (from RegTank forms)
  if (isFormData(data)) {
    return <FormDataDisplay data={data} label={label} />;
  }

  const renderValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined)
      return <span className="text-muted-foreground">-</span>;
    if (typeof value === "boolean") return value ? "Yes" : "No";
    // Check if string is a URL
    if (typeof value === "string" && isUrl(value)) {
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <LinkIcon className="h-3 w-3" />
          <span className="truncate max-w-[200px]">{shortenUrl(value)}</span>
          <ArrowTopRightOnSquareIcon className="h-3 w-3 shrink-0" />
        </a>
      );
    }
    if (typeof value === "object") {
      return (
        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }
    return String(value);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="border-b last:border-0 pb-2 last:pb-0">
            <div className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, " ")}</div>
            <div className="text-sm">{renderValue(value)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function OrganizationDetailDialog({
  portal,
  organizationId,
  open,
  onOpenChange,
}: OrganizationDetailDialogProps) {
  const { data: org, isLoading, error } = useOrganizationDetail(portal, organizationId);
  const updateSophisticatedMutation = useUpdateSophisticatedStatus();

  // State for sophisticated status change dialog
  const [showSophisticatedDialog, setShowSophisticatedDialog] = React.useState(false);
  const [pendingSophisticatedStatus, setPendingSophisticatedStatus] = React.useState<
    boolean | null
  >(null);
  const [sophisticatedReason, setSophisticatedReason] = React.useState("");

  const handleSophisticatedToggle = (checked: boolean) => {
    if (!organizationId) return;
    // Open dialog to collect reason
    setPendingSophisticatedStatus(checked);
    setSophisticatedReason("");
    setShowSophisticatedDialog(true);
  };

  const handleConfirmSophisticatedChange = () => {
    if (!organizationId || pendingSophisticatedStatus === null || !sophisticatedReason.trim())
      return;

    updateSophisticatedMutation.mutate(
      {
        organizationId,
        isSophisticatedInvestor: pendingSophisticatedStatus,
        reason: sophisticatedReason.trim(),
      },
      {
        onSuccess: () => {
          toast.success(
            pendingSophisticatedStatus
              ? "Marked as sophisticated investor"
              : "Removed sophisticated investor status"
          );
          setShowSophisticatedDialog(false);
          setPendingSophisticatedStatus(null);
          setSophisticatedReason("");
        },
        onError: (error) => {
          toast.error(`Failed to update status: ${error.message}`);
        },
      }
    );
  };

  const handleCancelSophisticatedChange = () => {
    setShowSophisticatedDialog(false);
    setPendingSophisticatedStatus(null);
    setSophisticatedReason("");
  };

  const displayName = React.useMemo(() => {
    if (!org) return "";
    if (org.type === "COMPANY") {
      return org.name || "Unnamed Company";
    }
    return org.firstName && org.lastName
      ? `${org.firstName} ${org.lastName}`
      : `${org.owner.firstName} ${org.owner.lastName}`;
  }, [org]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                {org?.type === "COMPANY" ? (
                  <BuildingOffice2Icon className="h-5 w-5 text-primary" />
                ) : (
                  <UserIcon className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <div>{isLoading ? "Loading..." : displayName}</div>
                {org && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className={
                        org.portal === "investor"
                          ? "border-primary/30 text-primary text-xs"
                          : "border-accent/30 text-accent text-xs"
                      }
                    >
                      {org.portal}
                    </Badge>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {org.type.toLowerCase()}
                    </Badge>
                  </div>
                )}
              </div>
            </DialogTitle>
            <DialogDescription className="flex items-center justify-between">
              <span>{org ? `Organization ID: ${org.id}` : "Loading organization details..."}</span>
              {org?.regtankPortalUrl && (
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <a href={org.regtankPortalUrl} target="_blank" rel="noopener noreferrer">
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    Open in RegTank
                  </a>
                </Button>
              )}
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="space-y-4 py-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-destructive">
              Error loading organization: {error instanceof Error ? error.message : "Unknown error"}
            </div>
          )}

          {org && (
            <div className="space-y-6 py-4">
              {/* Status & Dates */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ClockIcon className="h-4 w-4" />
                    Status & Dates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Onboarding Status</div>
                      <div className="mt-1">
                        {org.onboardingStatus === "COMPLETED" ? (
                          <Badge className="bg-emerald-500 text-white">
                            <CheckCircleIcon className="h-3 w-3 mr-1" />
                            Completed
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <ClockIcon className="h-3 w-3 mr-1" />
                            {org.onboardingStatus}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {/* Sophisticated Investor Status - only for investor portal */}
                    {portal === "investor" && (
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground mb-2">
                          Sophisticated Investor
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={org.isSophisticatedInvestor}
                            onCheckedChange={handleSophisticatedToggle}
                            disabled={updateSophisticatedMutation.isPending}
                          />
                          {org.isSophisticatedInvestor ? (
                            <Badge className="bg-violet-500 text-white">
                              <CheckCircleIcon className="h-3 w-3 mr-1" />
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              No
                            </Badge>
                          )}
                        </div>
                        {org.sophisticatedInvestorReason && (
                          <div className="mt-2 p-2 rounded-md bg-muted/50">
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium">Reason:</span>{" "}
                              {org.sophisticatedInvestorReason}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    <DetailRow
                      label="Onboarded At"
                      value={org.onboardedAt ? format(new Date(org.onboardedAt), "PPpp") : null}
                    />
                    <DetailRow label="Created" value={format(new Date(org.createdAt), "PPpp")} />
                    <DetailRow label="Updated" value={format(new Date(org.updatedAt), "PPpp")} />
                  </div>
                </CardContent>
              </Card>

              {/* Members - moved to top for visibility */}
              {org.members.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <UsersIcon className="h-4 w-4" />
                      Members ({org.members.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {org.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                              <UserIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <div className="text-sm font-medium">
                                {member.firstName} {member.lastName}
                              </div>
                              <div className="text-xs text-muted-foreground">{member.email}</div>
                            </div>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {member.role.toLowerCase()}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Company Info (for COMPANY type) */}
              {org.type === "COMPANY" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BuildingOffice2Icon className="h-4 w-4" />
                      Company Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <DetailRow label="Company Name" value={org.name} />
                      <DetailRow label="Registration Number (SSM)" value={org.registrationNumber} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Personal Details (from RegTank) */}
              {(org.firstName || org.lastName || org.nationality || org.dateOfBirth) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <IdentificationIcon className="h-4 w-4" />
                      Personal Details (KYC)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <DetailRow label="First Name" value={org.firstName} />
                      <DetailRow label="Last Name" value={org.lastName} />
                      <DetailRow label="Middle Name" value={org.middleName} />
                      <DetailRow label="Gender" value={org.gender} />
                      <DetailRow
                        label="Date of Birth"
                        value={org.dateOfBirth ? format(new Date(org.dateOfBirth), "PP") : null}
                      />
                      <DetailRow label="Nationality" value={org.nationality} />
                      <DetailRow label="Country" value={org.country} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contact Info */}
              {(org.phoneNumber || org.address) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <PhoneIcon className="h-4 w-4" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4">
                      <CopyableField label="Phone Number" value={org.phoneNumber} />
                      <CopyableField label="Address" value={org.address} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Document Info */}
              {(org.documentType || org.documentNumber || org.idIssuingCountry || org.kycId) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <DocumentTextIcon className="h-4 w-4" />
                      Document Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <DetailRow label="Document Type" value={org.documentType} />
                      <CopyableField
                        label="Document Number"
                        value={org.documentNumber}
                        icon={IdentificationIcon}
                      />
                      <DetailRow label="ID Issuing Country" value={org.idIssuingCountry} />
                      <CopyableField label="KYC ID" value={org.kycId} />
                    </div>
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* JSON Data Sections */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground">Extended Data</h3>

                <JsonDisplay
                  data={org.bankAccountDetails}
                  label={
                    <span className="flex items-center gap-2">
                      <BanknotesIcon className="h-4 w-4" />
                      Bank Account Details
                    </span>
                  }
                />

                <JsonDisplay
                  data={org.wealthDeclaration}
                  label={
                    <span className="flex items-center gap-2">
                      <DocumentTextIcon className="h-4 w-4" />
                      Wealth Declaration
                    </span>
                  }
                />

                <JsonDisplay
                  data={org.complianceDeclaration}
                  label={
                    <span className="flex items-center gap-2">
                      <ShieldCheckIcon className="h-4 w-4" />
                      Compliance Declaration
                    </span>
                  }
                />

                <JsonDisplay
                  data={org.documentInfo}
                  label={
                    <span className="flex items-center gap-2">
                      <DocumentTextIcon className="h-4 w-4" />
                      Document Info
                    </span>
                  }
                />

                <JsonDisplay
                  data={org.livenessCheckInfo}
                  label={
                    <span className="flex items-center gap-2">
                      <FaceSmileIcon className="h-4 w-4" />
                      Liveness Check Info
                    </span>
                  }
                />

                <KycResponseDisplay data={org.kycResponse} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AlertDialog for sophisticated investor status change */}
      <AlertDialog open={showSophisticatedDialog} onOpenChange={setShowSophisticatedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingSophisticatedStatus
                ? "Mark as Sophisticated Investor"
                : "Remove Sophisticated Investor Status"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingSophisticatedStatus
                ? "Please provide a reason for granting sophisticated investor status to this organization."
                : "Please provide a reason for removing sophisticated investor status from this organization."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="sophisticated-reason" className="text-sm font-medium">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="sophisticated-reason"
              placeholder={
                pendingSophisticatedStatus
                  ? "e.g., Manual verification of net assets exceeding RM3,000,000"
                  : "e.g., Re-evaluation of investor classification"
              }
              value={sophisticatedReason}
              onChange={(e) => setSophisticatedReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
            {sophisticatedReason.trim() === "" && (
              <p className="text-xs text-muted-foreground mt-1">Reason is required to proceed.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSophisticatedChange}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSophisticatedChange}
              disabled={!sophisticatedReason.trim() || updateSophisticatedMutation.isPending}
            >
              {updateSophisticatedMutation.isPending ? "Updating..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
