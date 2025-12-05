"use client";

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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createApiClient } from "@cashsouk/config";
import { EyeIcon, EyeSlashIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const apiClient = createApiClient(API_URL);

// Step 1: Initiate email change
const initiateEmailSchema = z
  .object({
    newEmail: z.string().email("Please enter a valid email address"),
    confirmEmail: z.string().email("Please enter a valid email address"),
    password: z.string().min(1, "Password is required to verify your identity"),
  })
  .refine((data) => data.newEmail === data.confirmEmail, {
    message: "Email addresses do not match",
    path: ["confirmEmail"],
  });

// Step 2: Verify code
const verifyCodeSchema = z.object({
  code: z.string().min(1, "Verification code is required"),
  password: z.string().min(1, "Password is required"),
});

type InitiateEmailFormValues = z.infer<typeof initiateEmailSchema>;
type VerifyCodeFormValues = z.infer<typeof verifyCodeSchema>;

interface ChangeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
  onEmailChanged?: (newEmail: string) => void;
}

export function ChangeEmailDialog({
  open,
  onOpenChange,
  currentEmail,
  onEmailChanged,
}: ChangeEmailDialogProps) {
  const [step, setStep] = React.useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [pendingEmail, setPendingEmail] = React.useState("");
  const [savedPassword, setSavedPassword] = React.useState("");

  const initiateForm = useForm<InitiateEmailFormValues>({
    resolver: zodResolver(initiateEmailSchema),
    defaultValues: {
      newEmail: "",
      confirmEmail: "",
      password: "",
    },
  });

  const verifyForm = useForm<VerifyCodeFormValues>({
    resolver: zodResolver(verifyCodeSchema),
    defaultValues: {
      code: "",
      password: "",
    },
  });

  // Reset forms when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setStep(1);
      initiateForm.reset();
      verifyForm.reset();
      setPendingEmail("");
      setSavedPassword("");
      setShowPassword(false);
    }
  }, [open, initiateForm, verifyForm]);

  const onInitiateSubmit = async (data: InitiateEmailFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await apiClient.initiateEmailChange({
        newEmail: data.newEmail,
        password: data.password,
      });

      if (!result.success) {
        toast.error("Failed to initiate email change", {
          description: result.error.message,
        });
        return;
      }

      // Save email and password for step 2
      setPendingEmail(data.newEmail);
      setSavedPassword(data.password);
      
      // Pre-fill password in verify form
      verifyForm.setValue("password", data.password);

      toast.success("Verification code sent", {
        description: `Please check ${data.newEmail} for the verification code.`,
      });

      setStep(2);
    } catch (error) {
      toast.error("Failed to initiate email change", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVerifySubmit = async (data: VerifyCodeFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await apiClient.verifyEmailChange({
        code: data.code,
        newEmail: pendingEmail,
        password: data.password,
      });

      if (!result.success) {
        toast.error("Failed to verify email change", {
          description: result.error.message,
        });
        return;
      }

      toast.success("Email changed successfully", {
        description: `Your email has been updated to ${result.data.newEmail}`,
      });

      onEmailChanged?.(result.data.newEmail);
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to verify email change", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    initiateForm.reset();
    verifyForm.reset();
    setStep(1);
    onOpenChange(false);
  };

  const handleBack = () => {
    verifyForm.reset();
    setStep(1);
  };

  const handleResendCode = async () => {
    if (!pendingEmail || !savedPassword) {
      toast.error("Please start over", {
        description: "Session expired. Please enter your new email again.",
      });
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiClient.initiateEmailChange({
        newEmail: pendingEmail,
        password: savedPassword,
      });

      if (!result.success) {
        toast.error("Failed to resend code", {
          description: result.error.message,
        });
        return;
      }

      toast.success("Verification code resent", {
        description: `Please check ${pendingEmail} for the new verification code.`,
      });
    } catch (error) {
      toast.error("Failed to resend code", {
        description:
          error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[450px]">
        {step === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle>Change Email Address</DialogTitle>
              <DialogDescription className="text-[15px]">
                Enter your new email address and current password. A verification
                code will be sent to your new email.
              </DialogDescription>
            </DialogHeader>

            <div className="mb-4 p-3 bg-muted rounded-xl">
              <p className="text-sm text-muted-foreground">Current email</p>
              <p className="text-[15px] font-medium">{currentEmail}</p>
            </div>

            <Form {...initiateForm}>
              <form
                onSubmit={initiateForm.handleSubmit(onInitiateSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={initiateForm.control}
                  name="newEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Enter new email address"
                          {...field}
                          className="h-11 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={initiateForm.control}
                  name="confirmEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="Confirm new email address"
                          {...field}
                          className="h-11 rounded-xl"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={initiateForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            {...field}
                            className="h-11 rounded-xl pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? (
                              <EyeSlashIcon className="h-5 w-5" />
                            ) : (
                              <EyeIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                  >
                    {isSubmitting ? "Sending..." : "Send Verification Code"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Verify Your New Email</DialogTitle>
              <DialogDescription className="text-[15px]">
                Enter the verification code sent to{" "}
                <span className="font-medium text-foreground">{pendingEmail}</span>
              </DialogDescription>
            </DialogHeader>

            <Form {...verifyForm}>
              <form
                onSubmit={verifyForm.handleSubmit(onVerifySubmit)}
                className="space-y-4"
              >
                <FormField
                  control={verifyForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verification Code</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter 6-digit code"
                          {...field}
                          className="h-11 rounded-xl text-center text-lg tracking-widest"
                          maxLength={6}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Hidden password field - pre-filled from step 1 */}
                <input type="hidden" {...verifyForm.register("password")} />

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={isSubmitting}
                    className="text-sm text-primary hover:underline disabled:opacity-50"
                  >
                    Didn&apos;t receive the code? Resend
                  </button>
                </div>

                <DialogFooter className="gap-2 sm:gap-0 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={isSubmitting}
                    className="gap-1"
                  >
                    <ArrowLeftIcon className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-primary text-primary-foreground shadow-brand hover:opacity-95"
                  >
                    {isSubmitting ? "Verifying..." : "Verify & Update Email"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

