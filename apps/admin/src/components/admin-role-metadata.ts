import {
  BanknotesIcon,
  CogIcon,
  DocumentCheckIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { AdminRole } from "@cashsouk/types";
import type { ComponentType } from "react";

export interface AdminRoleDisplayInfo {
  key: AdminRole;
  name: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  permissions: string[];
}

export const ADMIN_ROLE_DISPLAY: Record<AdminRole, AdminRoleDisplayInfo> = {
  [AdminRole.SUPER_ADMIN]: {
    key: AdminRole.SUPER_ADMIN,
    name: "Super Admin",
    icon: ShieldCheckIcon,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    description:
      "Full administrative access to all platform features and settings. Can manage all users, configure system settings, and oversee all operations.",
    permissions: [
      "Complete access to all modules",
      "User and role management",
      "Security and RBAC configuration",
      "Platform settings and limits",
      "All compliance and operational tools",
    ],
  },
  [AdminRole.COMPLIANCE_OFFICER]: {
    key: AdminRole.COMPLIANCE_OFFICER,
    name: "Compliance Officer",
    icon: DocumentCheckIcon,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    description:
      "Manages regulatory compliance, KYC verification, and fraud prevention. Ensures platform adheres to Malaysian financial regulations and Shariah principles.",
    permissions: [
      "KYC and AML verification",
      "Sanctions screening and blacklist management",
      "Regulatory reporting",
      "Access logs and audit trails",
      "Data export for compliance",
    ],
  },
  [AdminRole.OPERATIONS_OFFICER]: {
    key: AdminRole.OPERATIONS_OFFICER,
    name: "Operations Officer",
    icon: CogIcon,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    description:
      "Handles day-to-day platform operations including financing management, user support, and communication. Oversees investment processing and customer service.",
    permissions: [
      "Financing and investment management",
      "User account operations",
      "Repayment and transaction records",
      "Customer support tools",
      "Marketing and communications",
    ],
  },
  [AdminRole.FINANCE_OFFICER]: {
    key: AdminRole.FINANCE_OFFICER,
    name: "Finance Officer",
    icon: BanknotesIcon,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    description:
      "Manages financial operations including fund disbursements and payment processing. Monitors transaction flows and financial compliance.",
    permissions: [
      "Disbursement triggering",
      "Financial compliance viewing",
      "Data export for finance",
      "Limited financing operations access",
    ],
  },
};

export const ADMIN_ROLE_REFERENCE = Object.values(ADMIN_ROLE_DISPLAY);
