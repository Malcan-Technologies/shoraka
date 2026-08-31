import { TableCell, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@cashsouk/ui";
import { AuditEventBadge } from "@/components/audit/audit-event-badge";
import { AuditSourceBadge } from "@/components/audit/audit-source-badge";
import { AuditLogActorCell } from "@/components/audit/audit-log-actor-cell";
import {
  AuditLogViewDetailsButton,
  AUDIT_IP_CELL_CLASS,
  AUDIT_ROW_CLASS,
  AUDIT_TIMESTAMP_CELL_CLASS,
} from "@/components/audit/audit-log-shell";
import { formatAuditDateTime, formatRoleSwitchedLabel } from "@/components/audit/audit-presentation";
import type { AccessLogResponse } from "@cashsouk/types";

interface AccessLog extends Omit<AccessLogResponse, "created_at" | "event_type"> {
  created_at: Date;
  event_type: string;
}

interface AccessLogTableRowProps {
  log: AccessLog;
  onViewDetails: () => void;
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
  ONBOARDING_APPROVED: { label: "Onboarding Submission Approved", color: "bg-status-success-text" },
  AML_APPROVED: { label: "AML Approved", color: "bg-status-success-text" },
  TNC_APPROVED: { label: "T&C Approved", color: "bg-status-success-text" },
  TNC_ACCEPTED: { label: "T&C Accepted", color: "bg-status-success-text" },
  SSM_APPROVED: { label: "SSM Approved", color: "bg-status-success-text" },
  FINAL_APPROVAL_COMPLETED: { label: "Final Approval", color: "bg-status-success-text" },
  KYC_STATUS_UPDATED: { label: "KYC Updated", color: "bg-status-action-text" },
  PASSWORD_CHANGED: { label: "Password Changed", color: "bg-status-rejected-text" },
  EMAIL_VERIFIED: { label: "Email Verified", color: "bg-status-in-progress-text" },
  PROFILE_UPDATED: { label: "Profile Updated", color: "bg-status-submitted-text" },
  PLATFORM_FINANCE_SETTINGS_UPDATED: {
    label: "Platform Finance Settings Updated",
    color: "bg-status-active-text",
  },
  SOPHISTICATED_STATUS_UPDATED: { label: "Sophisticated Updated", color: "bg-status-active-text" },
};

export function AccessLogTableRow({
  log,
  onViewDetails,
  labelOverrides,
}: AccessLogTableRowProps) {
  const eventLabel =
    log.event_type === "ROLE_SWITCHED"
      ? formatRoleSwitchedLabel(log.metadata)
      : (labelOverrides?.[log.event_type] ?? EVENT_TYPE_CONFIG[log.event_type]?.label);
  const actorName = `${log.user.first_name} ${log.user.last_name}`.trim();
  const source = log.source || log.portal;

  return (
    <TableRow className={AUDIT_ROW_CLASS} onClick={onViewDetails}>
      <TableCell className={AUDIT_TIMESTAMP_CELL_CLASS}>
        {formatAuditDateTime(log.created_at)}
      </TableCell>
      <TableCell>
        <AuditEventBadge
          eventType={log.event_type}
          label={eventLabel}
          status={log.success ? "Success" : "Failed"}
          overrides={labelOverrides}
        />
      </TableCell>
      <AuditLogActorCell name={actorName} email={log.user.email} actorType={log.actor_type} />
      <TableCell>
        {source ? (
          <AuditSourceBadge source={source} />
        ) : (
          <span className="text-ui text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className={AUDIT_IP_CELL_CLASS}>{log.ip_address || "—"}</TableCell>
      <TableCell className="text-ui text-muted-foreground">{log.device_info || "—"}</TableCell>
      <TableCell>
        <StatusBadge
          label={log.success ? "Success" : "Failed"}
          status={log.success ? "success" : "rejected"}
        />
      </TableCell>
      <TableCell className="text-right">
        <AuditLogViewDetailsButton
          onClick={(event) => {
            event.stopPropagation();
            onViewDetails();
          }}
        />
      </TableCell>
    </TableRow>
  );
}
