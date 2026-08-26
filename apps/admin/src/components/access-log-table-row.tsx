import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EyeIcon } from "@heroicons/react/24/outline";
import type { AccessLogResponse, UserRole } from "@cashsouk/types";
import { PortalBadge, StatusBadge } from "@cashsouk/ui";
import { OrganizationTypeBadge } from "@/components/organization-type-badge";
import { AuditEventBadge } from "@/components/audit/audit-event-badge";
import { formatAuditDateTime } from "@/components/audit/audit-presentation";

interface AccessLog extends Omit<AccessLogResponse, "created_at" | "event_type"> {
  created_at: Date;
  event_type: string;
  role?: UserRole | null;
  organizationName?: string | null;
  organizationType?: "PERSONAL" | "COMPANY" | null;
}

interface AccessLogTableRowProps {
  log: AccessLog;
  onViewDetails: () => void;
  showRole?: boolean;
  showOrganization?: boolean;
  labelOverrides?: Record<string, string>;
}

export const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  LOGIN: { label: "Login", color: "bg-status-submitted-text" },
  LOGOUT: { label: "Logout", color: "bg-status-neutral-text" },
  SIGNUP: { label: "Sign Up", color: "bg-status-success-text" },
  ROLE_ADDED: { label: "Role Added", color: "bg-status-active-text" },
  ROLE_SWITCHED: { label: "Role Switched", color: "bg-status-in-progress-text" },
  ONBOARDING_STARTED: { label: "Onboarding Started", color: "bg-status-success-text" },
  ONBOARDING_RESUMED: { label: "Onboarding Resumed", color: "bg-status-in-progress-text" },
  ONBOARDING_CANCELLED: { label: "Onboarding Cancelled", color: "bg-status-neutral-text" },
  ONBOARDING_REJECTED: { label: "Onboarding Rejected", color: "bg-status-rejected-text" },
  ONBOARDING_STATUS_UPDATED: { label: "Status Updated", color: "bg-status-in-progress-text" },
  FORM_FILLED: { label: "Form Filled", color: "bg-status-submitted-text" },
  ONBOARDING_APPROVED: { label: "Onboarding Approved", color: "bg-status-success-text" },
  AML_APPROVED: { label: "AML Approved", color: "bg-status-success-text" },
  TNC_APPROVED: { label: "T&C Approved", color: "bg-status-success-text" },
  TNC_ACCEPTED: { label: "T&C Accepted", color: "bg-status-success-text" },
  SSM_APPROVED: { label: "SSM Approved", color: "bg-status-success-text" },
  FINAL_APPROVAL_COMPLETED: { label: "Final Approval", color: "bg-status-success-text" },
  KYC_STATUS_UPDATED: { label: "KYC Updated", color: "bg-status-action-text" },
  PASSWORD_CHANGED: { label: "Password Changed", color: "bg-status-rejected-text" },
  EMAIL_CHANGED: { label: "Email Verified", color: "bg-status-in-progress-text" },
  PROFILE_UPDATED: { label: "Profile Updated", color: "bg-status-submitted-text" },
  PLATFORM_FINANCE_SETTINGS_UPDATED: {
    label: "Platform Finance Settings Updated",
    color: "bg-status-active-text",
  },
  SOPHISTICATED_STATUS_UPDATED: { label: "Sophisticated Updated", color: "bg-status-active-text" },
};

function getRoleBadge(role: UserRole) {
  if (role === "INVESTOR" || role === "ISSUER") {
    return <PortalBadge portal={role === "INVESTOR" ? "investor" : "issuer"} />;
  }
  return <StatusBadge label="Admin" status="active" />;
}

export function AccessLogTableRow({
  log,
  onViewDetails,
  showRole = false,
  showOrganization = false,
  labelOverrides,
}: AccessLogTableRowProps) {
  const eventLabel = labelOverrides?.[log.event_type] ?? EVENT_TYPE_CONFIG[log.event_type]?.label;

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={onViewDetails}
    >
      <TableCell className="whitespace-nowrap text-ui text-muted-foreground">
        {formatAuditDateTime(log.created_at)}
      </TableCell>
      {showOrganization && (
        <>
          <TableCell className="text-ui text-muted-foreground">
            {log.organizationName || "—"}
          </TableCell>
          <TableCell>
            {log.organizationType ? (
              <OrganizationTypeBadge type={log.organizationType} />
            ) : (
              <span className="text-ui text-muted-foreground">—</span>
            )}
          </TableCell>
        </>
      )}
      <TableCell className="min-w-[180px] max-w-[280px]">
        <div className="flex min-w-0 flex-col">
          <span
            className="truncate text-ui font-medium"
            title={`${log.user.first_name} ${log.user.last_name}`}
          >
            {log.user.first_name} {log.user.last_name}
          </span>
          <span className="truncate text-meta text-muted-foreground" title={log.user.email}>
            {log.user.email}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <AuditEventBadge
          eventType={log.event_type}
          label={eventLabel}
          status={log.success ? "Success" : "Failed"}
          overrides={labelOverrides}
        />
      </TableCell>
      {showRole && (
        <TableCell>
          {log.role ? getRoleBadge(log.role) : <span className="text-ui text-muted-foreground">—</span>}
        </TableCell>
      )}
      <TableCell className="font-mono text-ui text-muted-foreground">{log.ip_address || "—"}</TableCell>
      <TableCell className="text-ui text-muted-foreground">{log.device_info || "—"}</TableCell>
      <TableCell>
        <StatusBadge label={log.success ? "Success" : "Failed"} status={log.success ? "success" : "rejected"} />
      </TableCell>
      <TableCell>
        <Button
          size="sm"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            onViewDetails();
          }}
          className="h-8 px-2"
        >
          <EyeIcon className="mr-1 h-4 w-4" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}
