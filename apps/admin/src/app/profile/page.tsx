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
import { createApiClient } from "@cashsouk/config";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@cashsouk/ui";
import {
  EnvelopeIcon,
  UserCircleIcon,
  PhoneIcon,
  ShieldCheckIcon,
  KeyIcon,
  PencilIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ChangePasswordDialog } from "../../components/change-password-dialog";
import { ChangeEmailDialog } from "../../components/change-email-dialog";
import { VerifyEmailDialog } from "../../components/verify-email-dialog";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { formatDistanceToNow } from "date-fns";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const apiClient = createApiClient(API_URL);

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
}

function ProfileSkeleton() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Profile</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-2xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Personal Information Skeleton */}
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
            <CardContent className="space-y-4">
              <Skeleton className="h-4 w-full max-w-md" />
              <Skeleton className="h-10 w-36" />
            </CardContent>
          </Card>

          {/* Account Info Skeleton */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-44" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-12" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = React.useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = React.useState(false);
  const [changeEmailOpen, setChangeEmailOpen] = React.useState(false);
  const [verifyEmailOpen, setVerifyEmailOpen] = React.useState(false);

  const { data: userData, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const result = await apiClient.get<{ user: UserData }>("/v1/auth/me");
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data.user;
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
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

  const handleChangeEmail = () => {
    setChangeEmailOpen(true);
  };

  const handleEmailChanged = () => {
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  };

  const handleEmailVerified = () => {
    queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  };

  const handleChangePassword = () => {
    setChangePasswordOpen(true);
  };

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-lg font-semibold">Profile</h1>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="max-w-2xl mx-auto w-full px-2 md:px-4 py-8 space-y-6">
          {/* Profile Information Card */}
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
                  <CardDescription>Manage your email address</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
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
                      className="bg-amber-50 text-amber-700 border-amber-200"
                    >
                      <ExclamationTriangleIcon className="h-3.5 w-3.5 mr-1" />
                      Unverified
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Your email is used for login and notifications
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleChangeEmail}>
                  Change Email Address
                </Button>
                {!userData?.email_verified && (
                  <Button variant="default" onClick={() => setVerifyEmailOpen(true)}>
                    Verify Now
                  </Button>
                )}
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
            </CardContent>
          </Card>

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
              <div className="space-y-2">
                <Label>Roles</Label>
                <div className="flex flex-wrap gap-2">
                  {userData?.roles.map((role) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className={
                        role === "ADMIN"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : role === "INVESTOR"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                      }
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

      <ChangeEmailDialog
        open={changeEmailOpen}
        onOpenChange={setChangeEmailOpen}
        currentEmail={userData?.email || ""}
        onEmailChanged={handleEmailChanged}
      />

      <VerifyEmailDialog
        open={verifyEmailOpen}
        onOpenChange={setVerifyEmailOpen}
        email={userData?.email || ""}
        onVerified={handleEmailVerified}
      />
    </>
  );
}
