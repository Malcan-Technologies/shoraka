import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";
import { ActivityType } from "@cashsouk/types";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        investment: "bg-[#E6F4EA] text-[#1E8E3E]",
        deposit: "bg-[#E8F0FE] text-[#1967D2]",
        withdrawal: "bg-[#F3E8FF] text-[#7E22CE]",
        login: "bg-[#E8F0FE] text-[#1967D2]",
        profile: "bg-[#FEF7E0] text-[#B06000]",
        security: "bg-[#E8F0FE] text-[#1967D2]",
        transaction: "bg-[#E6F4EA] text-[#1E8E3E]",
        settings: "bg-[#FEF7E0] text-[#B06000]",
        onboarding: "bg-[#E8F0FE] text-[#1967D2]",
        default: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface ActivityBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  type: ActivityType;
}

const typeConfig: Record<ActivityType, { label: string; variant: VariantProps<typeof badgeVariants>["variant"] }> = {
  INVESTMENT: { label: "Investment", variant: "investment" },
  DEPOSIT: { label: "Deposit", variant: "deposit" },
  WITHDRAWAL: { label: "Withdrawal", variant: "withdrawal" },
  LOGIN: { label: "Login", variant: "login" },
  LOGOUT: { label: "Logout", variant: "login" },
  LOGIN_FAILED: { label: "Login Failed", variant: "security" },
  NEW_DEVICE_LOGIN: { label: "Login", variant: "login" },
  PASSWORD_CHANGED: { label: "Security", variant: "security" },
  EMAIL_VERIFIED: { label: "Security", variant: "security" },
  SECURITY_ALERT: { label: "Security", variant: "security" },
  PROFILE_UPDATED: { label: "Profile Update", variant: "profile" },
  SETTINGS_CHANGED: { label: "Settings Change", variant: "settings" },
  TRANSACTION_COMPLETED: { label: "Transaction", variant: "transaction" },
  ONBOARDING_STARTED: { label: "Onboarding", variant: "onboarding" },
  ONBOARDING_COMPLETED: { label: "Onboarding", variant: "onboarding" },
  KYC_SUBMITTED: { label: "Onboarding", variant: "onboarding" },
};

export function ActivityBadge({ type, className, ...props }: ActivityBadgeProps) {
  const config = typeConfig[type] || { label: type, variant: "default" };
  return (
    <div className={cn(badgeVariants({ variant: config.variant }), className)} {...props}>
      {config.label}
    </div>
  );
}
