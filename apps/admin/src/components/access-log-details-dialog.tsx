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
import { CheckIcon, XMarkIcon, ClipboardDocumentIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import * as React from "react";
import type { EventType, AccessLogResponse } from "@cashsouk/types";

interface AccessLog extends Omit<AccessLogResponse, "created_at"> {
  created_at: Date;
}

interface AccessLogDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AccessLog | null;
}

const eventTypeColors: Partial<Record<EventType, string>> = {
  LOGIN: "bg-blue-100 text-blue-800 border-blue-200",
  LOGOUT: "bg-gray-100 text-gray-800 border-gray-200",
  SIGNUP: "bg-green-100 text-green-800 border-green-200",
  ROLE_ADDED: "bg-purple-100 text-purple-800 border-purple-200",
  ROLE_SWITCHED: "bg-orange-100 text-orange-800 border-orange-200",
  ONBOARDING_COMPLETED: "bg-teal-100 text-teal-800 border-teal-200",
  KYC_STATUS_UPDATED: "bg-yellow-100 text-yellow-800 border-yellow-200",
  ONBOARDING_STATUS_UPDATED: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

export function AccessLogDetailsDialog({
  open,
  onOpenChange,
  log,
}: AccessLogDetailsDialogProps) {
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

