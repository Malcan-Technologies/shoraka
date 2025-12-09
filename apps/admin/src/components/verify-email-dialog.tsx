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
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { EyeIcon, EyeSlashIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Step 1: Request verification code
const requestCodeSchema = z.object({
  password: z.string().min(1, "Password is required to verify your identity"),
});

// Step 2: Verify code
const verifyCodeSchema = z.object({
  code: z.string().min(1, "Verification code is required"),
  password: z.string().min(1, "Password is required"),
});

type RequestCodeFormValues = z.infer<typeof requestCodeSchema>;
type VerifyCodeFormValues = z.infer<typeof verifyCodeSchema>;

interface VerifyEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  onVerified?: () => void;
}

export function VerifyEmailDialog({
  open,
  onOpenChange,
  email,
  onVerified,
}: VerifyEmailDialogProps) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const [step, setStep] = React.useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [savedPassword, setSavedPassword] = React.useState("");

  const requestForm = useForm<RequestCodeFormValues>({
    resolver: zodResolver(requestCodeSchema),
    defaultValues: {
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
      requestForm.reset();
      verifyForm.reset();
      setSavedPassword("");
      setShowPassword(false);
    }
  }, [open, requestForm, verifyForm]);

  const onRequestSubmit = async (data: RequestCodeFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await apiClient.resendEmailVerification({
        password: data.password,
      });

      if (!result.success) {
        toast.error("Failed to send verification code", {
          description: result.error.message,
        });
        return;
      }

      // Save password for step 2
      setSavedPassword(data.password);
      verifyForm.setValue("password", data.password);

      toast.success("Verification code sent", {
        description: `Please check ${email} for the verification code.`,
      });

      setStep(2);
    } catch (error) {
      toast.error("Failed to send verification code", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onVerifySubmit = async (data: VerifyCodeFormValues) => {
    setIsSubmitting(true);
    try {
      const result = await apiClient.verifyEmail({
        code: data.code,
        password: data.password,
      });

      if (!result.success) {
        toast.error("Failed to verify email", {
          description: result.error.message,
        });
        return;
      }

      toast.success("Email verified successfully", {
        description: "Your email address has been verified.",
      });

      onVerified?.();
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to verify email", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    requestForm.reset();
    verifyForm.reset();
    setStep(1);
    onOpenChange(false);
  };

  const handleBack = () => {
    verifyForm.reset();
    setStep(1);
  };

  const handleResendCode = async () => {
    if (!savedPassword) {
      toast.error("Please start over", {
        description: "Session expired. Please enter your password again.",
      });
      setStep(1);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiClient.resendEmailVerification({
        password: savedPassword,
      });

      if (!result.success) {
        toast.error("Failed to resend code", {
          description: result.error.message,
        });
        return;
      }

      toast.success("Verification code resent", {
        description: `Please check ${email} for the new verification code.`,
      });
    } catch (error) {
      toast.error("Failed to resend code", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
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
              <DialogTitle>Verify Your Email</DialogTitle>
              <DialogDescription className="text-[15px]">
                Your email address is not verified. Enter your password to receive a verification
                code.
              </DialogDescription>
            </DialogHeader>

            <div className="mb-4 p-3 bg-muted rounded-xl">
              <p className="text-sm text-muted-foreground">Email to verify</p>
              <p className="text-[15px] font-medium">{email}</p>
            </div>

            <Form {...requestForm}>
              <form onSubmit={requestForm.handleSubmit(onRequestSubmit)} className="space-y-4">
                <FormField
                  control={requestForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
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
              <DialogTitle>Enter Verification Code</DialogTitle>
              <DialogDescription className="text-[15px]">
                Enter the verification code sent to{" "}
                <span className="font-medium text-foreground">{email}</span>
              </DialogDescription>
            </DialogHeader>

            <Form {...verifyForm}>
              <form onSubmit={verifyForm.handleSubmit(onVerifySubmit)} className="space-y-4">
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
                    {isSubmitting ? "Verifying..." : "Verify Email"}
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
