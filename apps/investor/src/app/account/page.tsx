"use client";

import * as React from "react";
import { SidebarTrigger } from "../../components/ui/sidebar";
import { Separator } from "../../components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import { Skeleton } from "../../components/ui/skeleton";
import { createApiClient, useAuthToken, useOrganization } from "@cashsouk/config";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  EnvelopeIcon,
  UserCircleIcon,
  ShieldCheckIcon,
  KeyIcon,
  XCircleIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolidIcon } from "@heroicons/react/24/solid";
import { ChangePasswordDialog } from "../../components/change-password-dialog";
import { formatDistanceToNow } from "date-fns";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import { CopyableField } from "@cashsouk/ui/copyable-field";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface UserData {
  id: string;
  user_id?: string | null;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  roles: string[];
  investor_account: string[];
  issuer_account: string[];
  password_changed_at: string | null;
}

interface MeResponse {
  user: UserData;
  activeRole: string | null;
  sessions: {
    active: number;
  };
  recentLogins: Array<{
    at: string;
    ip: string | null;
    device: string | null;
  }>;
}

function AccountPageSkeleton() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Skeleton className="h-7 w-7 rounded-md -ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Account</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-2xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Account Information Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Separator />
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-40" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-4 w-56" />
              </div>
              <Skeleton className="h-10 w-40" />
            </CardContent>
          </Card>

          {/* Password Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-4 w-52" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Skeleton className="h-4 w-full max-w-md" />
                <Skeleton className="h-10 w-36" />
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-6 w-32 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full max-w-md" />
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-6 w-28 rounded-full" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const { activeOrganization } = useOrganization();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);

  // Block access if organization is in PENDING_APPROVAL or REJECTED status
  useEffect(() => {
    const isPendingApproval = activeOrganization?.onboardingStatus === "PENDING_APPROVAL" ||
      activeOrganization?.regtankOnboardingStatus === "PENDING_APPROVAL";
    const isRejected = activeOrganization?.regtankOnboardingStatus === "REJECTED";

    if (isPendingApproval || isRejected) {
      router.replace("/");
    }
  }, [activeOrganization, router]);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["auth", "me", "profile"],
    queryFn: async () => {
      const result = await apiClient.get<MeResponse>("/v1/auth/me");
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Sync user data to the global cache for sidebar/nav components
  useEffect(() => {
    if (profileData?.user) {
      queryClient.setQueryData(["auth", "me"], profileData.user);
    }
  }, [profileData?.user, queryClient]);

  const userData = profileData?.user;

  const handleChangePassword = () => {
    setChangePasswordOpen(true);
  };

  if (isLoading) {
    return <AccountPageSkeleton />;
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Account</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-2xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Account Information Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <UserCircleIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Account Information</CardTitle>
                  <CardDescription>Your user ID and onboarding status</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">User ID</Label>
                <CopyableField
                  value={userData?.user_id || "Not assigned"}
                  placeholder="Not assigned"
                />
                <p className="text-[0.8rem] text-muted-foreground">
                  Your unique 5-letter identifier
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label className="text-base font-medium">Onboarding Status</Label>
                <div className="flex flex-wrap gap-2">
                  {(userData?.investor_account?.length ?? 0) > 0 ? (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      <CheckCircleSolidIcon className="h-3.5 w-3.5 mr-1" />
                      Investor
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground/60 border-muted">
                      <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                      Investor
                    </Badge>
                  )}
                  {(userData?.issuer_account?.length ?? 0) > 0 ? (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      <CheckCircleSolidIcon className="h-3.5 w-3.5 mr-1" />
                      Issuer
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground/60 border-muted">
                      <XCircleIcon className="h-3.5 w-3.5 mr-1" />
                      Issuer
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <EnvelopeIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Email Address</CardTitle>
                  <CardDescription>Your registered email address</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="email">Email</Label>
                  <InfoTooltip content="Email addresses cannot be changed for security reasons. Please contact support if you need to update your email." />
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    id="email"
                    type="email"
                    value={userData?.email || ""}
                    disabled
                    className="flex-1 bg-muted"
                  />
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <ShieldCheckIcon className="h-3.5 w-3.5 mr-1" />
                    Verified
                  </Badge>
                </div>
                <p className="text-[0.8rem] text-muted-foreground">
                  Your email is used for login and notifications
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Password & Security Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <KeyIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Password & Security</CardTitle>
                  <CardDescription>Manage your password and security settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-medium">Password</Label>
                  <p className="text-[0.8rem] text-muted-foreground mt-1">
                    Keep your account secure by using a strong password that you don&apos;t use
                    elsewhere.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Last changed:{" "}
                    {userData?.password_changed_at
                      ? formatDistanceToNow(new Date(userData.password_changed_at), {
                          addSuffix: true,
                        })
                      : "never"}
                  </p>
                </div>
                <Button variant="outline" onClick={handleChangePassword}>
                  Change Password
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Two-Factor Authentication (2FA)</Label>
                    <p className="text-[0.8rem] text-muted-foreground mt-1">
                      Additional security layer required for all accounts
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <ShieldCheckIcon className="h-3.5 w-3.5 mr-1" />
                    Enabled
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Two-factor authentication is enforced for all users and cannot be disabled.
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-medium">Recent Activity</Label>
                <div className="space-y-3">
                  {profileData?.recentLogins && profileData.recentLogins.length > 0 ? (
                    profileData.recentLogins.map((login, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <ComputerDesktopIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate" title={login.device || "Unknown Device"}>
                              {login.device || "Unknown Device"}
                            </p>
                            <p className="text-xs text-muted-foreground">IP: {login.ip || "Unknown"}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-medium">
                            {formatDistanceToNow(new Date(login.at), { addSuffix: true })}
                          </p>
                          <p className="text-[0.7rem] text-muted-foreground">
                            {new Date(login.at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
                      No recent activity found
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  This information helps you monitor unauthorized access to your account.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </>
  );
}
