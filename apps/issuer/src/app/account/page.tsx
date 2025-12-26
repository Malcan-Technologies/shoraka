"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import { Skeleton } from "../../components/ui/skeleton";
import { Button } from "../../components/ui/button";
import { useOrganization, type OrganizationMember, type OrganizationMemberRole } from "@cashsouk/config";
import { useAuth } from "../../lib/auth";
import {
  UserIcon,
  BuildingOffice2Icon,
  ShieldCheckIcon,
  UserGroupIcon,
  EnvelopeIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

const roleConfig: Record<OrganizationMemberRole, { label: string; color: string; bgColor: string; borderColor: string }> = {
  OWNER: {
    label: "Owner",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
  },
  DIRECTOR: {
    label: "Director",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  MEMBER: {
    label: "Member",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-border",
  },
};

function RoleBadge({ role }: { role: OrganizationMemberRole }) {
  const config = roleConfig[role];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${config.bgColor} border ${config.borderColor}`}
    >
      <ShieldCheckIcon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function MemberCard({ member }: { member: OrganizationMember }) {
  const fullName = [member.firstName, member.lastName].filter(Boolean).join(" ") || "Unknown";
  const initials = [member.firstName?.[0], member.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-lg">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{fullName}</p>
          <RoleBadge role={member.role} />
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
          <EnvelopeIcon className="h-3.5 w-3.5" />
          <p className="text-xs truncate">{member.email}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyMembersState() {
  return (
    <div className="rounded-xl border bg-card p-8 text-center">
      <div className="flex justify-center mb-4">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <UserGroupIcon className="h-6 w-6 text-muted-foreground" />
        </div>
      </div>
      <p className="text-muted-foreground">No members found for this account.</p>
      <p className="text-sm text-muted-foreground mt-2">
        Members will appear here once they are added to your organization.
      </p>
    </div>
  );
}

function AccountPageSkeleton() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Skeleton className="h-5 w-32" />
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-4xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
          <div className="space-y-4 mt-8">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </>
  );
}

function NoOrganizationState({ showOnboardingPrompt = true }: { showOnboardingPrompt?: boolean }) {
  const router = useRouter();

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold text-muted-foreground">Account</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-4xl mx-auto w-full px-2 md:px-4 py-8">
          <div className="rounded-xl border bg-card p-8 text-center opacity-60">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <UserIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-muted-foreground mb-2">No Account Selected</h2>
            <p className="text-muted-foreground mb-6">
              Create or select an account to view account details and members.
            </p>
            {showOnboardingPrompt && (
              <Button variant="outline" onClick={() => router.push("/onboarding-start")}>
                Create Account
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function AccountPage() {
  const { isAuthenticated } = useAuth();
  const { activeOrganization, isLoading, refreshOrganizations, organizations } = useOrganization();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshOrganizations();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Show loading state
  if (isAuthenticated === null || isLoading) {
    return <AccountPageSkeleton />;
  }

  // Show no organization state
  if (!activeOrganization || organizations.length === 0) {
    return <NoOrganizationState />;
  }

  const accountName = activeOrganization.name || "Company Account";
  const AccountIcon = BuildingOffice2Icon;

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Account</h1>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-4xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Page Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <AccountIcon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{accountName}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-muted-foreground">
                    Business Account
                  </span>
                  {activeOrganization.onboardingStatus === "COMPLETED" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                      <ClockIcon className="h-3.5 w-3.5" />
                      Pending Verification
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="gap-2 h-11 rounded-xl"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Account Details Card */}
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Account Details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Account Type</p>
                <p className="text-sm font-medium">Company</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
                <p className="text-sm font-medium">
                  {activeOrganization.onboardingStatus === "COMPLETED" ? "Active" : "Pending Verification"}
                </p>
              </div>
              {activeOrganization.registrationNumber && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Registration Number</p>
                  <p className="text-sm font-medium">{activeOrganization.registrationNumber}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Created</p>
                <p className="text-sm font-medium">
                  {new Date(activeOrganization.createdAt).toLocaleDateString("en-MY", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Members Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Members ({activeOrganization.members?.length || 0})
              </h2>
            </div>

            {activeOrganization.members && activeOrganization.members.length > 0 ? (
              <div className="grid gap-3">
                {activeOrganization.members.map((member) => (
                  <MemberCard key={member.id} member={member} />
                ))}
              </div>
            ) : (
              <EmptyMembersState />
            )}
          </div>

          {/* Role Definitions for Company Accounts */}
          <div className="px-4 py-3 bg-muted/20 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground mb-3">Role Definitions</p>
            <div className="flex flex-wrap gap-4">
              {Object.entries(roleConfig).map(([role, config]) => (
                <div key={role} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color} ${config.bgColor} border ${config.borderColor}`}
                  >
                    <ShieldCheckIcon className="h-3 w-3" />
                    {config.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

