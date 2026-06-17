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
import type {
  AdminRoleBadgeColor,
  AdminRoleConfigRecord,
  AdminRoleKey,
  PendingInvitation,
} from "@cashsouk/types";
import {
  ClockIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { getAdminRoleDisplayInfo } from "./admin-role-metadata";

interface PendingInvitationsTableProps {
  invitations: PendingInvitation[];
  availableRoles: AdminRoleConfigRecord[];
  isLoading?: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onResend: (invitationId: string) => void;
  onRevoke: (invitationId: string) => void;
  canManageRoles?: boolean;
}

function InvitationRow({
  invitation,
  inviteUrl,
  availableRoles,
  onResend,
  onRevoke,
  canManageRoles = false,
}: {
  invitation: PendingInvitation;
  inviteUrl: string;
  availableRoles: AdminRoleConfigRecord[];
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
  canManageRoles?: boolean;
}) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const roleRecord = availableRoles.find((role) => role.key === invitation.role_description);
  const roleDisplay = getAdminRoleDisplayInfo(
    invitation.role_description,
    roleRecord?.name,
    roleRecord?.description,
    roleRecord?.badgeColor
  );
  const isExpired = new Date(invitation.expires_at) < new Date();

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedId(invitation.id);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
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
          className="border font-medium"
          style={getRoleBadgeClasses(invitation.role_description, roleRecord?.badgeColor)}
        >
          {roleDisplay.name}
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
              disabled={!canManageRoles}
              title={!canManageRoles ? "You do not have permission to perform this action." : undefined}
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
            disabled={!canManageRoles}
            title={!canManageRoles ? "You do not have permission to perform this action." : undefined}
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

function getRoleBadgeClasses(
  roleKey: AdminRoleKey,
  badgeColor?: AdminRoleBadgeColor | null
) {
  return getAdminRoleDisplayInfo(roleKey, undefined, undefined, badgeColor ?? undefined).badgeStyle;
}

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
  availableRoles,
  isLoading = false,
  currentPage,
  totalPages,
  onPageChange,
  onResend,
  onRevoke,
}: PendingInvitationsTableProps) {
  const adminPortalUrl = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3003";

  const getInviteUrl = (token: string, role: AdminRoleKey) => {
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
                    availableRoles={availableRoles}
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
