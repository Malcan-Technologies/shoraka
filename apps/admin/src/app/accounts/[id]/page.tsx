"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  BuildingOffice2Icon,
  EyeIcon,
  IdentificationIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import type { UserDetailResponse, UserOrganizationSummary } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PortalBadge, Skeleton, StatusBadge } from "@cashsouk/ui";
import { OrganizationTypeBadge } from "@/components/organization-type-badge";
import { UserRoleBadges } from "@/components/user-role-badges";
import { getOrganizationOnboardingPresentation } from "@/lib/organization-status";
import { adminActionRowClass } from "@/lib/admin-status-token";
import {
  AdminEntityHeader,
  AdminEntitySummaryCard,
} from "@/components/admin-detail";
import { EditUserDialog } from "@/components/edit-user-dialog";
import {
  useUpdateUserId,
  useUpdateUserOnboarding,
  useUpdateUserProfile,
  useUserDetail,
} from "@/hooks/use-users";
import { RequirePermission } from "@/components/require-permission";
import { usePermissions } from "@/hooks/use-permissions";
import { accountHref, orgHref } from "@/lib/admin-directory-hrefs";

type OrganizationTab = "all" | "investor" | "issuer";

interface UserDraft {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  investorOnboarded: boolean;
  issuerOnboarded: boolean;
}

function buildDraft(user: UserDetailResponse): UserDraft {
  return {
    userId: user.user_id ?? "",
    firstName: user.first_name ?? "",
    lastName: user.last_name ?? "",
    phone: user.phone ?? "",
    investorOnboarded: user.investor_account.length > 0,
    issuerOnboarded: user.issuer_account.length > 0,
  };
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-24" />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-72 max-w-full" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              <Skeleton className="h-20 w-full rounded-xl sm:w-48" />
              <Skeleton className="h-20 w-full rounded-xl sm:w-48" />
              <Skeleton className="h-20 w-full rounded-xl sm:w-48" />
            </div>
          </div>
        </div>
        <div className="border-t px-6 py-4 md:px-8">
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium break-words">{value}</div>
    </div>
  );
}

function AccountSummaryCard({ user }: { user: UserDetailResponse }) {
  const displayName = `${user.first_name} ${user.last_name}`.trim() || user.email;

  return (
    <AdminEntityHeader
      variant="hero"
      tone={user.email_verified ? "success" : "action"}
      backHref="/accounts"
      backLabel="User Accounts"
      eyebrow="Account detail"
      title={displayName}
      subtitle={
        <>
          <span className="font-mono">{user.user_id}</span>
          {" · "}
          {user.email}
        </>
      }
      icon={UserIcon}
      chips={
        <>
          <StatusBadge
            label={user.email_verified ? "Email verified" : "Email unverified"}
            status={user.email_verified ? "success" : "action"}
          />
          <UserRoleBadges roles={user.roles} />
        </>
      }
      summaryCards={[
        <AdminEntitySummaryCard
          key="investor-orgs"
          label="Investor orgs"
          value={user.stats.investorOrganizations}
        />,
        <AdminEntitySummaryCard
          key="issuer-orgs"
          label="Issuer orgs"
          value={user.stats.issuerOrganizations}
        />,
        <AdminEntitySummaryCard
          key="access-logs"
          label="Access logs"
          value={user.stats.accessLogs}
        />,
      ]}
      metrics={[
        { label: "Phone", value: user.phone || "—" },
        {
          label: "Password changed",
          value: user.password_changed_at
            ? formatDistanceToNow(new Date(user.password_changed_at), { addSuffix: true })
            : "Never",
        },
        { label: "Created", value: format(new Date(user.created_at), "PPp") },
        {
          label: "Updated",
          value: formatDistanceToNow(new Date(user.updated_at), { addSuffix: true }),
        },
      ]}
    />
  );
}

function EditAccountCard({
  user,
  draft,
  onDraftChange,
  onSave,
  saving,
  canManage = true,
}: {
  user: UserDetailResponse;
  draft: UserDraft;
  onDraftChange: (draft: UserDraft) => void;
  onSave: () => void;
  saving: boolean;
  canManage?: boolean;
}) {
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(buildDraft(user));
  const disabledReason = !canManage ? "You do not have permission to perform this action." : undefined;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <IdentificationIcon className="h-4 w-4" />
          Edit Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="user-id">User ID</Label>
            <Input
              id="user-id"
              value={draft.userId}
              maxLength={5}
              className="font-mono uppercase"
              disabled={!canManage}
              title={disabledReason}
              onChange={(event) => {
                if (!canManage) return;
                onDraftChange({ ...draft, userId: event.target.value.toUpperCase().slice(0, 5) });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="first-name">First name</Label>
            <Input
              id="first-name"
              value={draft.firstName}
              disabled={!canManage}
              title={disabledReason}
              onChange={(event) => {
                if (!canManage) return;
                onDraftChange({ ...draft, firstName: event.target.value });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input
              id="last-name"
              value={draft.lastName}
              disabled={!canManage}
              title={disabledReason}
              onChange={(event) => {
                if (!canManage) return;
                onDraftChange({ ...draft, lastName: event.target.value });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={draft.phone}
              placeholder="+60..."
              disabled={!canManage}
              title={disabledReason}
              onChange={(event) => {
                if (!canManage) return;
                onDraftChange({ ...draft, phone: event.target.value });
              }}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Investor onboarding</div>
                <div className="text-xs text-muted-foreground">Controls the investor role and onboarding flag.</div>
              </div>
              <Switch
                checked={draft.investorOnboarded}
                disabled={!canManage}
                title={disabledReason}
                onCheckedChange={(checked) => {
                  if (!canManage) return;
                  onDraftChange({ ...draft, investorOnboarded: checked });
                }}
              />
            </div>
          </div>
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Issuer onboarding</div>
                <div className="text-xs text-muted-foreground">Controls the issuer role and onboarding flag.</div>
              </div>
              <Switch
                checked={draft.issuerOnboarded}
                disabled={!canManage}
                title={disabledReason}
                onCheckedChange={(checked) => {
                  if (!canManage) return;
                  onDraftChange({ ...draft, issuerOnboarded: checked });
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={!hasChanges || saving || !canManage} title={!canManage ? "You do not have permission to perform this action." : undefined}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountMetadataCard({ user }: { user: UserDetailResponse }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheckIcon className="h-4 w-4" />
          Account Metadata
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DetailRow label="Cognito Username" value={<span className="font-mono">{user.cognito_username}</span>} />
        <DetailRow label="Cognito Sub" value={<span className="font-mono">{user.cognito_sub}</span>} />
        <DetailRow label="Investments" value={user.stats.investments} />
        <DetailRow label="Loans" value={user.stats.loans} />
        <DetailRow label="Investor Account Flags" value={user.investor_account.length} />
        <DetailRow label="Issuer Account Flags" value={user.issuer_account.length} />
      </CardContent>
    </Card>
  );
}

function OrganizationsTable({
  user,
  activeTab,
  onTabChange,
}: {
  user: UserDetailResponse;
  activeTab: OrganizationTab;
  onTabChange: (tab: OrganizationTab) => void;
}) {
  const organizations = [
    ...user.organizations.investor,
    ...user.organizations.issuer,
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const filtered =
    activeTab === "all" ? organizations : organizations.filter((org) => org.portal === activeTab);
  const tabs: { value: OrganizationTab; label: string; count: number }[] = [
    { value: "all", label: "All", count: organizations.length },
    { value: "investor", label: "Investor", count: user.organizations.investor.length },
    { value: "issuer", label: "Issuer", count: user.organizations.issuer.length },
  ];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BuildingOffice2Icon className="h-4 w-4" />
              Organizations
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Investor and issuer organizations where this user is an owner or member.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-xl px-3 py-1">
            {organizations.length} {organizations.length === 1 ? "organization" : "organizations"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              type="button"
              size="sm"
              variant={activeTab === tab.value ? "default" : "outline"}
              className="rounded-full"
              onClick={() => onTabChange(tab.value)}
            >
              {tab.label}
              <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-xs">
                {tab.count}
              </span>
            </Button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Portal</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No organizations found for this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((org) => <OrganizationRow key={`${org.portal}-${org.id}`} organization={org} />)
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrganizationRow({ organization }: { organization: UserOrganizationSummary }) {
  const { can } = usePermissions();
  const canViewOrgs = can("organizations.view");
  const title =
    organization.name ??
    (organization.type === "COMPANY" ? "Unnamed company" : "Personal organization");
  const onboarding = getOrganizationOnboardingPresentation(organization.onboardingStatus);

  return (
    <TableRow
      className={
        onboarding.status === "action"
          ? adminActionRowClass(true)
          : "odd:bg-muted/40 hover:bg-muted"
      }
    >
      <TableCell>
        <PortalBadge portal={organization.portal} />
      </TableCell>
      <TableCell className="min-w-[260px]">
        <div className="font-medium">{title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <OrganizationTypeBadge type={organization.type} />
          {organization.registrationNumber ? <span>{organization.registrationNumber}</span> : null}
          {organization.isSophisticatedInvestor ? <span>Sophisticated investor</span> : null}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {organization.relationship}
          {organization.memberRole ? ` · ${organization.memberRole.toLowerCase()}` : ""}
        </Badge>
      </TableCell>
      <TableCell>
        <StatusBadge label={onboarding.label} status={onboarding.status} />
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm">{organization.memberCount}</TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {format(new Date(organization.updatedAt), "dd MMM yyyy")}
      </TableCell>
      <TableCell>
        {canViewOrgs ? (
          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
            <Link href={orgHref(organization.portal, organization.id)}>
              <EyeIcon className="h-4 w-4 mr-1" />
              View
            </Link>
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

export default function UserDetailPage() {
  const { can } = usePermissions();
  const canManage = can("users.manage");
  const canView = can("users.view");
  const params = useParams();
  const router = useRouter();
  const routeUserId = params.id as string;
  const { data: user, isLoading, error } = useUserDetail(routeUserId, { enabled: canView });
  const updateUserId = useUpdateUserId();
  const updateProfile = useUpdateUserProfile();
  const updateOnboarding = useUpdateUserOnboarding();

  const [draft, setDraft] = React.useState<UserDraft | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [organizationTab, setOrganizationTab] = React.useState<OrganizationTab>("all");

  React.useEffect(() => {
    if (user) {
      setDraft(buildDraft(user));
    }
  }, [user]);

  const isSaving = updateUserId.isPending || updateProfile.isPending || updateOnboarding.isPending;

  const handleConfirmSave = async () => {
    if (!user || !draft) return;
    const currentUserId = user.user_id ?? routeUserId;
    const nextUserId = draft.userId.trim().toUpperCase();
    if (!/^[A-Z]{5}$/.test(nextUserId)) {
      toast.error("User ID must be exactly 5 uppercase letters.");
      return;
    }

    try {
      let effectiveUserId = currentUserId;
      if (nextUserId !== currentUserId) {
        const result = await updateUserId.mutateAsync({ userId: currentUserId, newUserId: nextUserId });
        effectiveUserId = result.user_id;
      }

      const original = buildDraft(user);
      const profileChanged =
        draft.firstName !== original.firstName ||
        draft.lastName !== original.lastName ||
        draft.phone !== original.phone;
      if (profileChanged) {
        await updateProfile.mutateAsync({
          userId: effectiveUserId,
          data: {
            firstName: draft.firstName,
            lastName: draft.lastName,
            phone: draft.phone.trim() || null,
          },
        });
      }

      const onboardingChanged =
        draft.investorOnboarded !== original.investorOnboarded ||
        draft.issuerOnboarded !== original.issuerOnboarded;
      if (onboardingChanged) {
        await updateOnboarding.mutateAsync({
          userId: effectiveUserId,
          data: {
            investorOnboarded:
              draft.investorOnboarded !== original.investorOnboarded
                ? draft.investorOnboarded
                : undefined,
            issuerOnboarded:
              draft.issuerOnboarded !== original.issuerOnboarded ? draft.issuerOnboarded : undefined,
          },
        });
      }

      setShowConfirmDialog(false);
      toast.success("User updated successfully");
      if (effectiveUserId !== routeUserId) {
        router.replace(accountHref(effectiveUserId));
      }
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to update user");
    }
  };

  const displayName = user ? `${user.first_name} ${user.last_name}`.trim() || user.email : "User";

  return (
    <RequirePermission permission="users.view">
      <>
        <div className="flex-1 overflow-y-auto">
          <div className="w-full space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
            {isLoading ? <PageSkeleton /> : null}

            {error ? (
              <div className="py-8 text-center text-destructive">
                Error loading user: {error instanceof Error ? error.message : "Unknown error"}
              </div>
            ) : null}

            {user && draft ? (
              <>
                <AccountSummaryCard user={user} />
                <EditAccountCard
                  user={user}
                  draft={draft}
                  onDraftChange={setDraft}
                  onSave={() => setShowConfirmDialog(true)}
                  saving={isSaving}
                  canManage={canManage}
                />
                <AccountMetadataCard user={user} />
                <OrganizationsTable
                  user={user}
                  activeTab={organizationTab}
                  onTabChange={setOrganizationTab}
                />
              </>
            ) : null}
          </div>
        </div>

      <EditUserDialog
        open={showConfirmDialog}
        onOpenChange={(open) => {
          if (!isSaving) {
            setShowConfirmDialog(open);
          }
        }}
        userName={displayName}
        onConfirm={handleConfirmSave}
      />
      </>
    </RequirePermission>
  );
}
