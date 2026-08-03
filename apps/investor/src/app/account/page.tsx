"use client";

import * as React from "react";
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
import {
  createApiClient,
  useAuthToken,
  useOrganization,
  canAccessApplicantAccount,
} from "@cashsouk/config";
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
  BellIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon as CheckCircleSolidIcon } from "@heroicons/react/24/solid";
import { ChangePasswordDialog } from "../../components/change-password-dialog";
import { NotificationPreferences, PageShell, portalContentMaxWidthClassName, useHeader } from "@cashsouk/ui";
import { cn } from "@/lib/utils";
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

const successBadgeClass =
  "border-status-success-text/30 bg-status-success-bg text-status-success-text";

function AccountCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-4 w-56" />
      </CardContent>
    </Card>
  );
}

function AccountPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className={cn(portalContentMaxWidthClassName, "space-y-6 px-2 py-8 md:px-4")}>
        <PageShell title="My account" description="Your login details and security settings.">
          <div className="space-y-6">
            <AccountCardSkeleton />
            <AccountCardSkeleton />
            <AccountCardSkeleton />
            <AccountCardSkeleton />
          </div>
        </PageShell>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const { setTitle } = useHeader();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const { activeOrganization } = useOrganization();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);

  // PageShell owns the title — suppress chrome header duplicate.
  useEffect(() => {
    setTitle("");
  }, [setTitle]);

  useEffect(() => {
    if (
      activeOrganization &&
      !canAccessApplicantAccount(activeOrganization.onboardingStatus)
    ) {
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

  useEffect(() => {
    if (profileData?.user) {
      queryClient.setQueryData(["auth", "me"], profileData.user);
    }
  }, [profileData?.user, queryClient]);

  const userData = profileData?.user;

  if (isLoading) {
    return <AccountPageSkeleton />;
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className={cn(portalContentMaxWidthClassName, "space-y-6 px-2 py-8 md:px-4")}>
          <PageShell title="My account" description="Your login details and security settings.">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <UserCircleIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Account information</CardTitle>
                      <CardDescription>Your user ID and portal access</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-base font-medium">User ID</Label>
                    <CopyableField
                      value={userData?.user_id || "Not assigned"}
                      placeholder="Not assigned"
                    />
                    <p className="text-[13px] leading-5 text-muted-foreground">
                      Your unique 5-letter identifier
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-base font-medium">Portal access</Label>
                    <div className="flex flex-wrap gap-2">
                      {(userData?.investor_account?.length ?? 0) > 0 ? (
                        <Badge variant="outline" className={successBadgeClass}>
                          <CheckCircleSolidIcon className="mr-1 h-3.5 w-3.5" />
                          Investor
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted text-muted-foreground/60">
                          <XCircleIcon className="mr-1 h-3.5 w-3.5" />
                          Investor
                        </Badge>
                      )}
                      {(userData?.issuer_account?.length ?? 0) > 0 ? (
                        <Badge variant="outline" className={successBadgeClass}>
                          <CheckCircleSolidIcon className="mr-1 h-3.5 w-3.5" />
                          Issuer
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted text-muted-foreground/60">
                          <XCircleIcon className="mr-1 h-3.5 w-3.5" />
                          Issuer
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <EnvelopeIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Email</CardTitle>
                      <CardDescription>Used for login and important notices</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="email">Email</Label>
                    <InfoTooltip content="Email addresses cannot be changed for security reasons. Please contact support if you need to update your email." />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      id="email"
                      type="email"
                      value={userData?.email || ""}
                      disabled
                      className="max-w-md flex-1 bg-muted"
                    />
                    <Badge variant="outline" className={successBadgeClass}>
                      <ShieldCheckIcon className="mr-1 h-3.5 w-3.5" />
                      Verified
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <KeyIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Password & security</CardTitle>
                      <CardDescription>Keep your login secure</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-base font-medium">Password</Label>
                      <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                        Use a strong password that you do not reuse elsewhere.
                      </p>
                      <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
                        Last changed:{" "}
                        {userData?.password_changed_at
                          ? formatDistanceToNow(new Date(userData.password_changed_at), {
                              addSuffix: true,
                            })
                          : "never"}
                      </p>
                    </div>
                    <Button variant="outline" onClick={() => setChangePasswordOpen(true)}>
                      Change password
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Label className="text-base font-medium">
                          Two-factor authentication (2FA)
                        </Label>
                        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                          Extra security required for all accounts
                        </p>
                      </div>
                      <Badge variant="outline" className={successBadgeClass}>
                        <ShieldCheckIcon className="mr-1 h-3.5 w-3.5" />
                        Enabled
                      </Badge>
                    </div>
                    <p className="text-[13px] leading-5 text-muted-foreground">
                      Two-factor authentication is required and cannot be turned off.
                    </p>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <Label className="text-base font-medium">Recent sign-ins</Label>
                    <div className="space-y-3">
                      {profileData?.recentLogins && profileData.recentLogins.length > 0 ? (
                        profileData.recentLogins.map((login, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-sm"
                          >
                            <div className="flex items-center gap-3">
                              <ComputerDesktopIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <p
                                  className="truncate text-sm font-medium"
                                  title={login.device || "Unknown device"}
                                >
                                  {login.device || "Unknown device"}
                                </p>
                                <p className="text-[13px] text-muted-foreground">
                                  IP: {login.ip || "Unknown"}
                                </p>
                              </div>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[13px] font-medium">
                                {formatDistanceToNow(new Date(login.at), { addSuffix: true })}
                              </p>
                              <p className="text-[12px] text-muted-foreground">
                                {new Date(login.at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                          No recent sign-ins found
                        </div>
                      )}
                    </div>
                    <p className="text-[13px] leading-5 text-muted-foreground">
                      Review this list if you notice unusual access to your account.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <BellIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Marketing emails</CardTitle>
                      <CardDescription>
                        Choose which promotional messages you receive
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <NotificationPreferences />
                </CardContent>
              </Card>
            </div>
          </PageShell>
        </div>
      </div>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </>
  );
}
