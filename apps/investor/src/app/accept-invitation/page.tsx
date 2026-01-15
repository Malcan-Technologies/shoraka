"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { Button } from "../../components/ui/button";
import { CheckCircleIcon, XCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function AcceptInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const token = searchParams.get("token");

  const acceptMutation = useMutation({
    mutationFn: async (invitationToken: string) => {
      const result = await apiClient.post("/v1/organizations/invitations/accept", {
        token: invitationToken,
      });
      if (!result.success) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
    onSuccess: () => {
      toast.success("Invitation accepted successfully!");
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    },
    onError: (error: Error) => {
      toast.error("Failed to accept invitation", { description: error.message });
    },
  });

  React.useEffect(() => {
    if (token) {
      acceptMutation.mutate(token);
    }
  }, [token]);

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <XCircleIcon className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Invalid Invitation</h1>
          <p className="text-muted-foreground">No invitation token provided.</p>
          <Button onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (acceptMutation.isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <ArrowPathIcon className="h-12 w-12 text-primary mx-auto animate-spin" />
          <h1 className="text-2xl font-bold">Accepting Invitation</h1>
          <p className="text-muted-foreground">Please wait...</p>
        </div>
      </div>
    );
  }

  if (acceptMutation.isSuccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <CheckCircleIcon className="h-12 w-12 text-green-600 mx-auto" />
          <h1 className="text-2xl font-bold">Invitation Accepted</h1>
          <p className="text-muted-foreground">You have successfully joined the organization.</p>
          <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  if (acceptMutation.isError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <XCircleIcon className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Failed to Accept Invitation</h1>
          <p className="text-muted-foreground">
            {acceptMutation.error instanceof Error
              ? acceptMutation.error.message
              : "An error occurred while accepting the invitation."}
          </p>
          <Button onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return null;
}
