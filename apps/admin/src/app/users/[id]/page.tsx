"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import {
  ArrowLeftIcon,
  BuildingOffice2Icon,
  EyeIcon,
  IdentificationIcon,
  ShieldCheckIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import type { UserDetailResponse, UserOrganizationSummary, UserRole } from "@cashsouk/types";
import { toTitleCase } from "@cashsouk/types";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { SystemHealthIndicator } from "@/components/system-health-indicator";
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
import { Skeleton } from "@cashsouk/ui";
import { EditUserDialog } from "@/components/edit-user-dialog";
import {
  useUpdateUserId,
  useUpdateUserOnboarding,
  useUpdateUserProfile,
  useUserDetail,
} from "@/hooks/use-users";

type OrganizationTab = "all" | "investor" | "issuer";

interface UserDraft {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string;
  investorOnboarded: boolean;
  issuerOnboarded: boolean;
}

const ROLE_CONFIG: Record<UserRole, { label: string; className: string }> = {
  INVESTOR: { label: "Investor", className: "text-blue-600 dark:text-blue-300" },
  ISSUER: { label: "Issuer", className: "text-amber-600 dark:text-amber-300" },
  ADMIN: { label: "Admin", className: "text-violet-600 dark:text-violet-300" },
};

function RoleText({ roles }: { roles: UserRole[] }) {
  if (roles.length === 0) {
    return <span className="text-muted-foreground">none</span>;
  }

  return (
    <span>
      {roles.map((role, index) => {
        const config = ROLE_CONFIG[role] ?? {
          label: role.toLowerCase(),
          className: "text-muted-foreground",
        };
        return (
          <React.Fragment key={role}>
            <span className={config.className}>{config.label}</span>
            {index < roles.length - 1 ? <span className="text-muted-foreground">, </span> : null}
          </React.Fragment>
        );
      })}
    </span>
  );
}

function statusBadgeClass(status: string) {
  if (["COMPLETED", "APPROVED", "ACTIVE"].includes(status)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (["PENDING_APPROVAL", "PENDING_AML", "PENDING_SSM_REVIEW", "PENDING_FINAL_APPROVAL"].includes(status)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
  if (["REJECTED", "FAILED", "EXPIRED"].includes(status)) {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  }
  return "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300";
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
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
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
    <Card className="rounded-2xl">
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <UserIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{displayName}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {user.user_id}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    user.email_verified
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-700"
                  }
                >
                  {user.email_verified ? "Email verified" : "Email unverified"}
                </Badge>
              </div>
              <div className="mt-2 text-sm">
                <span className="font-medium text-foreground">Roles: </span>
                <RoleText roles={user.roles} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="grid gap-3 text-right sm:grid-cols-3">
            <div>
              <div className="text-2xl font-semibold">{user.stats.investorOrganizations}</div>
              <div className="text-xs text-muted-foreground">Investor orgs</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{user.stats.issuerOrganizations}</div>
              <div className="text-xs text-muted-foreground">Issuer orgs</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{user.stats.accessLogs}</div>
              <div className="text-xs text-muted-foreground">Access logs</div>
            </div>
          </div>
        </div>

        <Separator className="my-5" />

        <div className="grid gap-4 md:grid-cols-4">
          <DetailRow label="Phone" value={user.phone || "—"} />
          <DetailRow
            label="Password Changed"
            value={
              user.password_changed_at
                ? formatDistanceToNow(new Date(user.password_changed_at), { addSuffix: true })
                : "Never"
            }
          />
          <DetailRow label="Created" value={format(new Date(user.created_at), "PPp")} />
          <DetailRow label="Updated" value={formatDistanceToNow(new Date(user.updated_at), { addSuffix: true })} />
        </div>
      </CardContent>
    </Card>
  );
}

function EditAccountCard({
  user,
  draft,
  onDraftChange,
  onSave,
  saving,
}: {
  user: UserDetailResponse;
  draft: UserDraft;
  onDraftChange: (draft: UserDraft) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const hasChanges = JSON.stringify(draft) !== JSON.stringify(buildDraft(user));

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
              onChange={(event) =>
                onDraftChange({ ...draft, userId: event.target.value.toUpperCase().slice(0, 5) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="first-name">First name</Label>
            <Input
              id="first-name"
              value={draft.firstName}
              onChange={(event) => onDraftChange({ ...draft, firstName: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input
              id="last-name"
              value={draft.lastName}
              onChange={(event) => onDraftChange({ ...draft, lastName: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={draft.phone}
              placeholder="+60..."
              onChange={(event) => onDraftChange({ ...draft, phone: event.target.value })}
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
                onCheckedChange={(checked) => onDraftChange({ ...draft, investorOnboarded: checked })}
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
                onCheckedChange={(checked) => onDraftChange({ ...draft, issuerOnboarded: checked })}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={!hasChanges || saving}>
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
        <DetailRow label="Internal ID" value={<span className="font-mono">{user.id}</span>} />
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
  const title =
    organization.name ??
    (organization.type === "COMPANY" ? "Unnamed company" : "Personal organization");

  return (
    <TableRow className="odd:bg-muted/40 hover:bg-muted">
      <TableCell>
        <Badge
          variant="outline"
          className={
            organization.portal === "investor"
              ? "border-primary/30 text-primary"
              : "border-accent/30 text-accent"
          }
        >
          {organization.portal}
        </Badge>
      </TableCell>
      <TableCell className="min-w-[260px]">
        <div className="font-medium">{title}</div>
        <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{toTitleCase(organization.type)}</span>
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
        <Badge variant="outline" className={statusBadgeClass(organization.onboardingStatus)}>
          {toTitleCase(organization.onboardingStatus)}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm">{organization.memberCount}</TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {format(new Date(organization.updatedAt), "dd MMM yyyy")}
      </TableCell>
      <TableCell>
        <Button asChild variant="ghost" size="sm" className="h-8 px-2">
          <Link href={`/organizations/${organization.portal}/${encodeURIComponent(organization.id)}`}>
            <EyeIcon className="h-4 w-4 mr-1" />
            View
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const routeUserId = params.id as string;
  const { data: user, isLoading, error } = useUserDetail(routeUserId);
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
        router.replace(`/users/${encodeURIComponent(effectiveUserId)}`);
      }
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Failed to update user");
    }
  };

  const displayName = user ? `${user.first_name} ${user.last_name}`.trim() || user.email : "User";

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/users")}
          className="-ml-1 gap-1.5"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Users
        </Button>
        <Separator orientation="vertical" className="mx-2 h-4" />
        <h1 className="truncate text-lg font-semibold">{isLoading ? "Loading..." : displayName}</h1>
        <div className="ml-auto">
          <SystemHealthIndicator />
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0">
        <div className="w-full space-y-6 px-2 py-8 md:px-4">
          {isLoading ? <PageSkeleton /> : null}

          {error ? (
            <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">
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
  );
}
