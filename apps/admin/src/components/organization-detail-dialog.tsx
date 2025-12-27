"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@cashsouk/ui";
import { useOrganizationDetail } from "@/hooks/use-organization-detail";
import type { PortalType } from "@cashsouk/types";
import { format } from "date-fns";
import {
  UserIcon,
  BuildingOffice2Icon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  IdentificationIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
  BanknotesIcon,
  ShieldCheckIcon,
  FaceSmileIcon,
  ArrowTopRightOnSquareIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";

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
  return Array.isArray(obj.content) && obj.content.length > 0 && 
    obj.content.every((item: unknown) => 
      typeof item === "object" && item !== null && "fieldName" in item
    );
}

// Render form field value based on type
function renderFormFieldValue(field: FormField): React.ReactNode {
  const { fieldValue, fieldType } = field;
  
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
  
  return <span className="font-medium">{String(fieldValue)}</span>;
}

// Display form data with proper formatting
function FormDataDisplay({ data, label }: { data: FormData; label: React.ReactNode }) {
  const fields = data.content || [];
  
  // Filter out empty header-only fields and group by sections
  const visibleFields = fields.filter(field => {
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
      </CardHeader>
      <CardContent className="space-y-1">
        {visibleFields.map((field, idx) => {
          // Render headers as section dividers
          if (field.fieldType === "header") {
            const isSection = field.fieldName.endsWith(":") || field.fieldName.includes("Declaration");
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
          
          return (
            <div key={idx} className="flex flex-col py-1.5 border-b last:border-0">
              <div className="text-xs text-muted-foreground">{displayName}</div>
              <div className="text-sm">{renderFormFieldValue(field)}</div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function JsonDisplay({ data, label }: { data: Record<string, unknown> | null; label: React.ReactNode }) {
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  // Check if this is form data (from RegTank forms)
  if (isFormData(data)) {
    return <FormDataDisplay data={data} label={label} />;
  }

  const renderValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">-</span>;
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
            <div className="text-xs text-muted-foreground capitalize">
              {key.replace(/_/g, " ")}
            </div>
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
              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-1.5"
              >
                <a
                  href={org.regtankPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
                  <DetailRow
                    label="Onboarded At"
                    value={org.onboardedAt ? format(new Date(org.onboardedAt), "PPpp") : null}
                    icon={CalendarDaysIcon}
                  />
                  <DetailRow
                    label="Created"
                    value={format(new Date(org.createdAt), "PPpp")}
                    icon={CalendarDaysIcon}
                  />
                  <DetailRow
                    label="Updated"
                    value={format(new Date(org.updatedAt), "PPpp")}
                    icon={CalendarDaysIcon}
                  />
                </div>
              </CardContent>
            </Card>

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
                    <DetailRow label="Company Name" value={org.name} icon={BuildingOffice2Icon} />
                    <DetailRow
                      label="Registration Number (SSM)"
                      value={org.registrationNumber}
                      icon={IdentificationIcon}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Owner Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <UserIcon className="h-4 w-4" />
                  Owner Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <DetailRow
                    label="Name"
                    value={`${org.owner.firstName} ${org.owner.lastName}`}
                    icon={UserIcon}
                  />
                  <DetailRow label="Email" value={org.owner.email} icon={EnvelopeIcon} />
                  <DetailRow label="User ID" value={org.owner.userId} icon={IdentificationIcon} />
                </div>
              </CardContent>
            </Card>

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
                    <DetailRow label="First Name" value={org.firstName} icon={UserIcon} />
                    <DetailRow label="Last Name" value={org.lastName} icon={UserIcon} />
                    <DetailRow label="Middle Name" value={org.middleName} icon={UserIcon} />
                    <DetailRow label="Gender" value={org.gender} icon={UserIcon} />
                    <DetailRow
                      label="Date of Birth"
                      value={org.dateOfBirth ? format(new Date(org.dateOfBirth), "PP") : null}
                      icon={CalendarDaysIcon}
                    />
                    <DetailRow label="Nationality" value={org.nationality} icon={GlobeAltIcon} />
                    <DetailRow label="Country" value={org.country} icon={GlobeAltIcon} />
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
                    <DetailRow label="Phone Number" value={org.phoneNumber} icon={PhoneIcon} />
                    <DetailRow label="Address" value={org.address} icon={MapPinIcon} />
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
                    <DetailRow label="Document Type" value={org.documentType} icon={DocumentTextIcon} />
                    <DetailRow label="Document Number" value={org.documentNumber} icon={IdentificationIcon} />
                    <DetailRow label="ID Issuing Country" value={org.idIssuingCountry} icon={GlobeAltIcon} />
                    <DetailRow label="KYC ID" value={org.kycId} icon={IdentificationIcon} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Members */}
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
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

