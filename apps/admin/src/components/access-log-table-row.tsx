import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckIcon, XMarkIcon, EyeIcon } from "@heroicons/react/24/outline";
import { format } from "date-fns";
import type { AccessLogResponse, UserRole } from "@cashsouk/types";

interface AccessLog extends Omit<AccessLogResponse, "created_at"> {
  created_at: Date;
  role?: UserRole | null;
  organizationName?: string | null;
  organizationType?: "PERSONAL" | "COMPANY" | null;
}

interface AccessLogTableRowProps {
  log: AccessLog;
  onViewDetails: () => void;
  showRole?: boolean;
  showOrganization?: boolean;
}

// Event type configuration with dot color and readable label
const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  LOGIN: { label: "Login", color: "bg-blue-500" },
  LOGOUT: { label: "Logout", color: "bg-gray-500" },
  SIGNUP: { label: "Sign Up", color: "bg-green-500" },
  ROLE_ADDED: { label: "Role Added", color: "bg-purple-500" },
  ROLE_SWITCHED: { label: "Role Switched", color: "bg-orange-500" },
  USER_COMPLETED: { label: "User Completed", color: "bg-teal-500" },
  ONBOARDING_STARTED: { label: "Onboarding Started", color: "bg-emerald-500" },
  ONBOARDING_RESUMED: { label: "Onboarding Resumed", color: "bg-cyan-500" },
  ONBOARDING_CANCELLED: { label: "Onboarding Cancelled", color: "bg-gray-500" },
  ONBOARDING_REJECTED: { label: "Onboarding Rejected", color: "bg-red-500" },
  ONBOARDING_STATUS_UPDATED: { label: "Status Updated", color: "bg-indigo-500" },
  FORM_FILLED: { label: "Form Filled", color: "bg-sky-500" },
  ONBOARDING_APPROVED: { label: "Onboarding Approved", color: "bg-green-500" },
  AML_APPROVED: { label: "AML Approved", color: "bg-lime-500" },
  TNC_APPROVED: { label: "T&C Approved", color: "bg-emerald-500" },
  TNC_ACCEPTED: { label: "T&C Accepted", color: "bg-emerald-500" },
  SSM_APPROVED: { label: "SSM Approved", color: "bg-teal-500" },
  FINAL_APPROVAL_COMPLETED: { label: "Final Approval", color: "bg-green-500" },
  KYC_STATUS_UPDATED: { label: "KYC Updated", color: "bg-yellow-500" },
  PASSWORD_CHANGED: { label: "Password Changed", color: "bg-rose-500" },
  EMAIL_CHANGED: { label: "Email Changed", color: "bg-cyan-500" },
  PROFILE_UPDATED: { label: "Profile Updated", color: "bg-blue-500" },
  SOPHISTICATED_STATUS_UPDATED: { label: "Sophisticated Updated", color: "bg-violet-500" },
};

// Role configuration with dot color
const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  INVESTOR: { label: "Investor", color: "bg-blue-500" },
  ISSUER: { label: "Issuer", color: "bg-purple-500" },
  ADMIN: { label: "Admin", color: "bg-red-500" },
};

// Map Tailwind color class to CSS color for background
const COLOR_MAP: Record<string, string> = {
  "bg-blue-500": "rgb(59 130 246)",
  "bg-gray-500": "rgb(107 114 128)",
  "bg-green-500": "rgb(34 197 94)",
  "bg-purple-500": "rgb(168 85 247)",
  "bg-orange-500": "rgb(249 115 22)",
  "bg-teal-500": "rgb(20 184 166)",
  "bg-emerald-500": "rgb(16 185 129)",
  "bg-cyan-500": "rgb(6 182 212)",
  "bg-red-500": "rgb(239 68 68)",
  "bg-indigo-500": "rgb(99 102 241)",
  "bg-sky-500": "rgb(14 165 233)",
  "bg-lime-500": "rgb(132 204 22)",
  "bg-yellow-500": "rgb(234 179 8)",
  "bg-rose-500": "rgb(244 63 94)",
  "bg-violet-500": "rgb(139 92 246)",
};

function getEventTypeBadge(eventType: string) {
  const config = EVENT_TYPE_CONFIG[eventType];
  const color = config?.color || "bg-gray-500";
  const label =
    config?.label ||
    eventType
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  const cssColor = COLOR_MAP[color] || "rgb(107 114 128)";

  return (
    <Badge
      variant="outline"
      className="text-xs"
      style={{
        backgroundColor: `color-mix(in srgb, ${cssColor} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${cssColor} 30%, transparent)`,
      }}
    >
      <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${color}`} />
      {label}
    </Badge>
  );
}

function getRoleBadge(role: UserRole) {
  const config = ROLE_CONFIG[role];
  const cssColor = COLOR_MAP[config.color] || "rgb(107 114 128)";

  return (
    <Badge
      variant="outline"
      className="text-xs"
      style={{
        backgroundColor: `color-mix(in srgb, ${cssColor} 10%, transparent)`,
        borderColor: `color-mix(in srgb, ${cssColor} 30%, transparent)`,
      }}
    >
      <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${config.color}`} />
      {config.label}
    </Badge>
  );
}

export function AccessLogTableRow({
  log,
  onViewDetails,
  showRole = false,
  showOrganization = false,
}: AccessLogTableRowProps) {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="text-sm text-muted-foreground">
        {format(log.created_at, "MMM dd, yyyy HH:mm")}
      </TableCell>
      {showOrganization && (
        <>
          <TableCell className="text-sm text-muted-foreground">
            {log.organizationName || "—"}
          </TableCell>
          <TableCell>
            {log.organizationType ? (
              <Badge variant="outline" className="text-xs">
                {log.organizationType === "COMPANY" ? "Company" : "Personal"}
              </Badge>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </TableCell>
        </>
      )}
      <TableCell className="min-w-[180px] max-w-[280px]">
        <div className="flex flex-col min-w-0">
          <span
            className="text-sm font-medium truncate"
            title={`${log.user.first_name} ${log.user.last_name}`}
          >
            {log.user.first_name} {log.user.last_name}
          </span>
          <span className="text-xs text-muted-foreground truncate" title={log.user.email}>
            {log.user.email}
          </span>
        </div>
      </TableCell>
      <TableCell>{getEventTypeBadge(log.event_type)}</TableCell>
      {showRole && (
        <TableCell>
          {log.role ? (
            getRoleBadge(log.role)
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </TableCell>
      )}
      <TableCell className="font-mono text-sm text-muted-foreground">
        {log.ip_address || "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{log.device_info || "—"}</TableCell>
      <TableCell>
        {log.success ? (
          <div className="flex items-center gap-1.5 text-green-600">
            <CheckIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Success</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-red-600">
            <XMarkIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Failed</span>
          </div>
        )}
      </TableCell>
      <TableCell>
        <Button size="sm" variant="ghost" onClick={onViewDetails} className="h-8">
          <EyeIcon className="h-4 w-4 mr-1" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
