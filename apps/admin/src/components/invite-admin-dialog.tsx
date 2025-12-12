import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useInviteAdmin, useGenerateInvitationUrl } from "@/hooks/use-admin-users";
import { AdminRole } from "@cashsouk/types";
import { ClipboardIcon, CheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

const inviteAdminSchema = z.object({
  email: z.string().email("Please enter a valid email address").optional(),
  roleDescription: z.nativeEnum(AdminRole, {
    required_error: "Please select a role",
  }),
});

type InviteAdminFormValues = z.infer<typeof inviteAdminSchema>;

interface InviteAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const roleOptions = [
  { value: AdminRole.SUPER_ADMIN, label: "Super Admin" },
  { value: AdminRole.COMPLIANCE_OFFICER, label: "Compliance Officer" },
  { value: AdminRole.OPERATIONS_OFFICER, label: "Operations Officer" },
  { value: AdminRole.FINANCE_OFFICER, label: "Finance Officer" },
];

export function InviteAdminDialog({ open, onOpenChange }: InviteAdminDialogProps) {
  const [inviteUrl, setInviteUrl] = React.useState<string | null>(null);
  const [messageId, setMessageId] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [emailSent, setEmailSent] = React.useState(false);
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const inviteMutation = useInviteAdmin();
  const generateUrlMutation = useGenerateInvitationUrl();

  const form = useForm<InviteAdminFormValues>({
    resolver: zodResolver(inviteAdminSchema),
    defaultValues: {
      email: "",
      roleDescription: undefined,
    },
  });

  const formValues = form.watch();
  // Only role is required for link generation

  React.useEffect(() => {
    if (!open) {
      form.reset();
      setInviteUrl(null);
      setMessageId(null);
      setCopied(false);
      setEmailSent(false);
      setEmailError(null);
    }
  }, [open, form]);

  const handleGenerateAndCopyLink = async () => {
    if (!formValues.roleDescription) {
      form.trigger("roleDescription"); // Trigger validation to show errors
      return;
    }

    try {
      const result = await generateUrlMutation.mutateAsync({
        email: formValues.email, // Optional
        roleDescription: formValues.roleDescription,
      });

      setInviteUrl(result.inviteUrl);

      // Copy to clipboard
      await navigator.clipboard.writeText(result.inviteUrl);
      setCopied(true);
      toast.success("Invitation link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to generate link", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  };

  const onSubmit = async (data: InviteAdminFormValues) => {
    try {
      const result = await inviteMutation.mutateAsync({
        email: data.email,
        roleDescription: data.roleDescription,
      });

      // Store URL for Copy Link button, but don't show it in the UI if email was sent
      setInviteUrl(result.inviteUrl);
      setMessageId(result.messageId || null);
      setEmailSent(result.emailSent || false);
      setEmailError(result.emailError || null);

      // Show appropriate toast based on email status
      if (data.email) {
        if (result.emailSent) {
          toast.success("Invitation sent!", {
            description: `An invitation has been sent via email to ${data.email}`,
          });
        } else {
          toast.warning("Invitation link generated, but email failed to send", {
            description: result.emailError || "Please copy the link manually to share it.",
          });
        }
      } else {
        toast.success("Invitation link generated", {
          description: "Copy the link to share it with the admin user.",
        });
      }
    } catch (error) {
      toast.error("Failed to send invitation", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    }
  };

  const handleCopyLink = async () => {
    if (inviteUrl) {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        toast.success("Link copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast.error("Failed to copy link");
      }
    }
  };

  const handleCancel = () => {
    setInviteUrl(null);
    setMessageId(null);
    setEmailSent(false);
    setEmailError(null);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Admin User</DialogTitle>
          <DialogDescription className="text-[15px]">
            Send an invitation to a new admin user with assigned role and permissions.
          </DialogDescription>
        </DialogHeader>

        {(emailSent || emailError) ? (
          <div className="space-y-4">
            {emailSent ? (
              <div className="rounded-lg border bg-green-50 border-green-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckIcon className="h-5 w-5 text-green-600" />
                  <p className="text-sm font-medium text-green-900">
                    Email sent successfully
                  </p>
                </div>
                <p className="text-sm text-green-700">
                  An invitation has been sent to {form.getValues("email")}.
                </p>
                {messageId && (
                  <p className="text-xs text-green-600 mt-2">
                    Email ID: {messageId}
                  </p>
                )}
              </div>
            ) : emailError ? (
              <div className="rounded-lg border bg-yellow-50 border-yellow-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />
                  <p className="text-sm font-medium text-yellow-900">
                    Email failed to send
                  </p>
                </div>
                <p className="text-sm text-yellow-700 mb-2">
                  The invitation link was generated, but the email could not be sent.
                </p>
                <p className="text-xs text-yellow-600">
                  Error: {emailError}
                </p>
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  setInviteUrl(null);
                  setMessageId(null);
                  setEmailSent(false);
                  setEmailError(null);
                  form.reset();
                  onOpenChange(false);
                }}
                className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : inviteUrl ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground mb-2">
                Invitation link generated. You can copy it to share directly.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={inviteUrl}
                readOnly
                className="h-11 rounded-xl font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyLink}
                className="h-11 w-11"
                title="Copy link"
              >
                {copied ? (
                  <CheckIcon className="h-4 w-4 text-green-600" />
                ) : (
                  <ClipboardIcon className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyLink}
              className="w-full h-11"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-4 w-4 mr-2 text-green-600" />
                  Link Copied!
                </>
              ) : (
                <>
                  <ClipboardIcon className="h-4 w-4 mr-2" />
                  Copy Invitation Link
                </>
              )}
            </Button>
            <DialogFooter>
              <Button
                type="button"
                onClick={() => {
                  setInviteUrl(null);
                  setMessageId(null);
                  form.reset();
                  onOpenChange(false);
                }}
                className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="admin@cashsouk.com (optional)"
                        {...field}
                        className="h-11 rounded-xl"
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to generate a shareable link that works for anyone
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="roleDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Role</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value as AdminRole)}
                      value={field.value}
                    >
                    <FormControl>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

              {inviteUrl && (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Input
                      value={inviteUrl}
                      readOnly
                      className="h-9 rounded-lg font-mono text-xs flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyLink}
                      className="h-9 w-9"
                      title="Copy link"
                    >
                      {copied ? (
                        <CheckIcon className="h-4 w-4 text-green-600" />
                      ) : (
                        <ClipboardIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Invitation link generated. You can copy it or send via email below.
                  </p>
                </div>
              )}

              <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between items-center">
                <div className="flex gap-2 w-full sm:w-auto order-2 sm:order-1">
                  <Button type="button" variant="outline" onClick={handleCancel} className="flex-1 sm:flex-none">
                Cancel
              </Button>
                  {formValues.email && (
              <Button
                type="submit"
                      disabled={inviteMutation.isPending || !formValues.roleDescription}
                      className="bg-primary text-primary-foreground shadow-brand hover:opacity-95 flex-1 sm:flex-none"
              >
                      {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                    </Button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateAndCopyLink}
                  disabled={!formValues.roleDescription || generateUrlMutation.isPending}
                  className="w-full sm:w-auto order-1 sm:order-2 flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <CheckIcon className="h-4 w-4 text-green-600" />
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <ClipboardIcon className="h-4 w-4" />
                      Copy Link
                    </>
                  )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
