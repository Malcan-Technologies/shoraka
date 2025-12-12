import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton, Badge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import type { PendingInvitation, AdminRole } from "@cashsouk/types";
import {
  ClockIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface PendingInvitationsTableProps {
  invitations: PendingInvitation[];
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onResend: (invitationId: string) => void;
  onRevoke: (invitationId: string) => void;
}

function InvitationRow({
  invitation,
  inviteUrl,
  onResend,
  onRevoke,
}: {
  invitation: PendingInvitation;
  inviteUrl: string;
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
}) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const colors = roleColors[invitation.role_description];
  const isExpired = new Date(invitation.expires_at) < new Date();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedId(invitation.id);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="max-w-xs truncate">{invitation.email}</div>
      </TableCell>
      <TableCell>
        <Badge
          className={`${colors.bg} ${colors.text} ${colors.border} border font-medium hover:${colors.bg}`}
        >
          {roleLabels[invitation.role_description]}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-sm">
          <div className="font-medium">
            {invitation.invited_by.first_name} {invitation.invited_by.last_name}
          </div>
          <div className="text-muted-foreground text-xs">{invitation.invited_by.email}</div>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-sm">
          <ClockIcon className="size-4 text-muted-foreground" />
          <span className={isExpired ? "text-destructive font-medium" : "text-muted-foreground"}>
            {isExpired
              ? "Expired"
              : formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            disabled={copiedId === invitation.id}
            className="gap-1.5"
          >
            {copiedId === invitation.id ? (
              <>
                <CheckCircleIcon className="size-4 text-green-600" />
                Copied
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="size-4" />
                Copy Link
              </>
            )}
          </Button>
          {!invitation.email.startsWith("invitation-") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResend(invitation.id)}
              className="gap-1.5"
            >
              <PaperAirplaneIcon className="size-4" />
              Resend Email
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRevoke(invitation.id)}
            className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
          >
            <XMarkIcon className="size-4" />
            Revoke
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

const roleColors: Record<AdminRole, { bg: string; text: string; border: string }> = {
  SUPER_ADMIN: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
  },
  COMPLIANCE_OFFICER: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  OPERATIONS_OFFICER: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  FINANCE_OFFICER: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
};

const roleLabels: Record<AdminRole, string> = {
  SUPER_ADMIN: "Super Admin",
  COMPLIANCE_OFFICER: "Compliance Officer",
  OPERATIONS_OFFICER: "Operations Officer",
  FINANCE_OFFICER: "Finance Officer",
};

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton className="h-5 w-48" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-6 w-36 rounded-full" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-32" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-8 w-40" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function PendingInvitationsTable({
  invitations = [],
  isLoading = false,
  currentPage,
  totalPages,
  onPageChange,
  onResend,
  onRevoke,
}: PendingInvitationsTableProps) {
  const adminPortalUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3003";

  const getInviteUrl = (token: string, role: AdminRole) => {
    return `${adminPortalUrl}/callback?invitation=${token}&role=${role}`;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-sm font-semibold">Email</TableHead>
                <TableHead className="text-sm font-semibold">Role</TableHead>
                <TableHead className="text-sm font-semibold">Invited By</TableHead>
                <TableHead className="text-sm font-semibold">Expires</TableHead>
                <TableHead className="text-sm font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableSkeleton />
              ) : invitations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                    No pending invitations found
                  </TableCell>
                </TableRow>
              ) : (
                invitations.map((invitation) => (
                  <InvitationRow
                    key={invitation.id}
                    invitation={invitation}
                    inviteUrl={getInviteUrl(invitation.token, invitation.role_description)}
                    onResend={onResend}
                    onRevoke={onRevoke}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
