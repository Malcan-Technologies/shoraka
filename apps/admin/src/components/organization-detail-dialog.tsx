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

function JsonDisplay({ data, label }: { data: Record<string, unknown> | null; label: React.ReactNode }) {
  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  const renderValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-muted-foreground">-</span>;
    if (typeof value === "boolean") return value ? "Yes" : "No";
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
          <DialogDescription>
            {org ? `Organization ID: ${org.id}` : "Loading organization details..."}
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

