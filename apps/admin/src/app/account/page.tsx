"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../components/ui/form";
import { Badge } from "../../components/ui/badge";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@cashsouk/ui";
import { CURRENT_USER_QUERY_KEY } from "../../hooks/use-current-user";
import {
  EnvelopeIcon,
  UserCircleIcon,
  PhoneIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  KeyIcon,
  PencilIcon,
  XMarkIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { ChangePasswordDialog } from "../../components/change-password-dialog";
import { formatDistanceToNow } from "date-fns";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().max(20).optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface UserData {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email_verified: boolean;
  roles: string[];
  password_changed_at: string | null;
  admin: {
    status: string;
    role_description: string | null;
  } | null;
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
        <SidebarTrigger className="-ml-1" />
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
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-36" />
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
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const [isEditing, setIsEditing] = React.useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);

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
  React.useEffect(() => {
    if (profileData?.user) {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, {
        user: profileData.user,
        activeRole: profileData.activeRole,
        sessions: profileData.sessions,
        recentLogins: profileData.recentLogins,
      });
    }
  }, [profileData, queryClient]);

  const userData = profileData?.user;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      phone: "",
    },
  });

  // Update form values when user data loads
  React.useEffect(() => {
    if (userData) {
      form.reset({
        firstName: userData.first_name || "",
        lastName: userData.last_name || "",
        phone: userData.phone || "",
      });
    }
  }, [userData, form]);

  const updateProfile = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const result = await apiClient.updateMyProfile({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
      });
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
      toast.success("Profile updated successfully");
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast.error("Failed to update profile", {
        description: error.message,
      });
    },
  });

  const onSubmit = (data: ProfileFormValues) => {
    updateProfile.mutate(data);
  };

  const handleCancelEdit = () => {
    if (userData) {
      form.reset({
        firstName: userData.first_name || "",
        lastName: userData.last_name || "",
        phone: userData.phone || "",
      });
    }
    setIsEditing(false);
  };

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
          {/* Account Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ShieldCheckIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Account Information</CardTitle>
                  <CardDescription>Your account details and roles</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">Admin Role</Label>
                <div className="flex flex-wrap gap-2">
                  {userData?.admin?.role_description ? (
                    <Badge
                      variant="outline"
                      className={
                        userData.admin.role_description === "SUPER_ADMIN"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : userData.admin.role_description === "COMPLIANCE_OFFICER"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : userData.admin.role_description === "OPERATIONS_OFFICER"
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-green-50 text-green-700 border-green-200"
                      }
                    >
                      {userData.admin.role_description === "SUPER_ADMIN"
                        ? "Super Admin"
                        : userData.admin.role_description === "COMPLIANCE_OFFICER"
                          ? "Compliance Officer"
                          : userData.admin.role_description === "OPERATIONS_OFFICER"
                            ? "Operations Officer"
                            : "Finance Officer"}
                    </Badge>
                  ) : (
                    <p className="text-sm text-muted-foreground">No admin role assigned</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Information Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <UserCircleIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Personal Information</CardTitle>
                    <CardDescription>Update your personal details</CardDescription>
                  </div>
                </div>
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="gap-2"
                  >
                    <PencilIcon className="h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your first name"
                              {...field}
                              disabled={!isEditing}
                              className={!isEditing ? "bg-muted" : ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your last name"
                              {...field}
                              disabled={!isEditing}
                              className={!isEditing ? "bg-muted" : ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <PhoneIcon className="h-4 w-4" />
                          Phone Number
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="+60 12 345 6789"
                            {...field}
                            value={field.value || ""}
                            disabled={!isEditing}
                            className={!isEditing ? "bg-muted" : ""}
                          />
                        </FormControl>
                        <FormDescription>Enter your phone number with country code</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isEditing && (
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={updateProfile.isPending}
                      >
                        <XMarkIcon className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button type="submit" disabled={updateProfile.isPending}>
                        {updateProfile.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                </form>
              </Form>
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
                  {userData?.email_verified ? (
                    <Badge
                      variant="outline"
                      className="bg-green-50 text-green-700 border-green-200"
                    >
                      <ShieldCheckIcon className="h-3.5 w-3.5 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-yellow-50 text-yellow-700 border-yellow-200"
                    >
                      <ShieldExclamationIcon className="h-3.5 w-3.5 mr-1" />
                      Not Verified
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground mt-1">
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
                    <p className="text-sm text-muted-foreground mt-1">
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
