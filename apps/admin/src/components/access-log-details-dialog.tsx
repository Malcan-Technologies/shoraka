"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
  StarIcon,
  CpuChipIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import * as React from "react";
import type { AccessLogResponse } from "@cashsouk/types";

// Type for sophisticated status metadata
interface SophisticatedStatusMetadata {
  organizationId: string;
  previousStatus: boolean;
  previousReason?: string | null;
  newStatus: boolean;
  newReason: string;
  updatedBy: string;
  action: "granted" | "revoked" | "auto_granted";
  source?: string;
}

// Type guard for sophisticated status metadata
function isSophisticatedStatusMetadata(metadata: unknown): metadata is SophisticatedStatusMetadata {
  if (!metadata || typeof metadata !== "object") return false;
  const m = metadata as Record<string, unknown>;
  return (
    typeof m.organizationId === "string" &&
    typeof m.newStatus === "boolean" &&
    typeof m.action === "string" &&
    ["granted", "revoked", "auto_granted"].includes(m.action as string)
  );
}

interface AccessLog extends Omit<AccessLogResponse, "created_at"> {
  created_at: Date;
}

interface AccessLogDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AccessLog | null;
}

// Extended event type colors including onboarding-specific events
const eventTypeColors: Record<string, string> = {
  LOGIN: "bg-blue-100 text-blue-800 border-blue-200",
  LOGOUT: "bg-gray-100 text-gray-800 border-gray-200",
  SIGNUP: "bg-green-100 text-green-800 border-green-200",
  ROLE_ADDED: "bg-purple-100 text-purple-800 border-purple-200",
  ROLE_SWITCHED: "bg-orange-100 text-orange-800 border-orange-200",
  USER_COMPLETED: "bg-teal-100 text-teal-800 border-teal-200",
  ONBOARDING_STARTED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ONBOARDING_RESUME: "bg-amber-100 text-amber-800 border-amber-200",
  FORM_FILLED: "bg-sky-100 text-sky-800 border-sky-200",
  ONBOARDING_APPROVED: "bg-lime-100 text-lime-800 border-lime-200",
  AML_APPROVED: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200",
  KYC_STATUS_UPDATED: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ONBOARDING_STATUS_UPDATED: "bg-indigo-100 text-indigo-800 border-indigo-200",
  ONBOARDING_CANCELLED: "bg-red-100 text-red-800 border-red-200",
  ONBOARDING_REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
  FINAL_APPROVAL_COMPLETED: "bg-green-100 text-green-800 border-green-200",
  SSM_APPROVED: "bg-pink-100 text-pink-800 border-pink-200",
  TNC_ACCEPTED: "bg-teal-100 text-teal-800 border-teal-200",
  SOPHISTICATED_STATUS_UPDATED: "bg-violet-100 text-violet-800 border-violet-200",
};

export function AccessLogDetailsDialog({ open, onOpenChange, log }: AccessLogDetailsDialogProps) {
  const [copied, setCopied] = React.useState(false);

  if (!log) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Access Log Details
            <Badge variant="outline" className={`text-xs ${eventTypeColors[log.event_type]}`}>
              {log.event_type.replace(/_/g, " ")}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Log ID: {log.id} • {format(log.created_at, "PPpp")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold mb-3">User Information</h4>
            <div className="space-y-2 text-[15px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">
                  {log.user.first_name} {log.user.last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{log.user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Roles:</span>
                <div className="flex gap-1">
                  {log.user.roles.map((role) => (
                    <Badge key={role} variant="secondary" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-semibold mb-3">Event Details</h4>
            <div className="space-y-2 text-[15px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                {log.success ? (
                  <div className="flex items-center gap-1.5 text-green-600">
                    <CheckIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">Success</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-red-600">
                    <XMarkIcon className="h-4 w-4" />
                    <span className="text-sm font-medium">Failed</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IP Address:</span>
                <span className="font-mono text-sm">{log.ip_address || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Device:</span>
                <span className="text-sm">{log.device_info || "—"}</span>
              </div>
            </div>
          </div>

          {log.user_agent && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">User Agent</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(log.user_agent || "")}
                    className="h-7"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <code className="text-xs break-all">{log.user_agent}</code>
                </div>
              </div>
            </>
          )}

          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Metadata</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(JSON.stringify(log.metadata, null, 2))}
                    className="h-7"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>

                {/* Special display for sophisticated status updates */}
                {isSophisticatedStatusMetadata(log.metadata) &&
                  (() => {
                    const meta = log.metadata as SophisticatedStatusMetadata;
                    return (
                      <div className="bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 p-4 rounded-lg space-y-3 mb-3">
                        <div className="flex items-center gap-2">
                          <StarIcon className="h-5 w-5 text-violet-600" />
                          <span className="font-medium text-violet-900 dark:text-violet-100">
                            Sophisticated Investor Status Change
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">New Status:</span>
                            <div className="mt-1">
                              {meta.newStatus ? (
                                <Badge className="bg-violet-500 text-white">
                                  <CheckIcon className="h-3 w-3 mr-1" />
                                  Sophisticated
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Standard
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div>
                            <span className="text-muted-foreground">Previous Status:</span>
                            <div className="mt-1">
                              {meta.previousStatus ? (
                                <Badge
                                  variant="outline"
                                  className="text-violet-600 border-violet-300"
                                >
                                  Sophisticated
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                  Standard
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="col-span-2">
                            <span className="text-muted-foreground">Updated By:</span>
                            <div className="mt-1 flex items-center gap-2">
                              {meta.action === "auto_granted" ? (
                                <>
                                  <CpuChipIcon className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm font-medium">System (Automatic)</span>
                                  {meta.source && (
                                    <Badge variant="secondary" className="text-xs">
                                      {meta.source === "regtank_onboarding"
                                        ? "RegTank Onboarding"
                                        : meta.source}
                                    </Badge>
                                  )}
                                </>
                              ) : (
                                <>
                                  <UserIcon className="h-4 w-4 text-orange-600" />
                                  <span className="text-sm font-medium">
                                    Admin ({meta.updatedBy})
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {meta.newReason && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Reason:</span>
                              <p className="mt-1 text-sm bg-white dark:bg-muted/50 p-2 rounded border">
                                {meta.newReason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                {/* Default JSON display for other metadata */}
                <div className="bg-muted/50 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{JSON.stringify(log.metadata, null, 2)}</pre>
                </div>
              </div>
            </>
          )}

          {log.cognito_event && Object.keys(log.cognito_event).length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">Cognito Event</h4>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(JSON.stringify(log.cognito_event, null, 2))}
                    className="h-7"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4 mr-1" />
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg overflow-x-auto">
                  <pre className="text-xs">{JSON.stringify(log.cognito_event, null, 2)}</pre>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
