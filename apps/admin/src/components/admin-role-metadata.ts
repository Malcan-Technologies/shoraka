import { CogIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import {
  AdminRole,
  DEFAULT_ADMIN_ROLE_BADGE_COLOR,
  SUPER_ADMIN_BADGE_COLOR,
  type AdminRoleBadgeColor,
  type AdminRoleKey,
} from "@cashsouk/types";
import type { CSSProperties, ComponentType } from "react";

export interface AdminRoleDisplayInfo {
  key: AdminRoleKey;
  name: string;
  badgeColor: AdminRoleBadgeColor;
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  badgeStyle: CSSProperties;
  iconStyle: CSSProperties;
  description: string;
}

const SEEDED_ROLE_DISPLAY: Partial<Record<AdminRoleKey, Omit<AdminRoleDisplayInfo, "badgeColor">>> = {
  [AdminRole.SUPER_ADMIN]: {
    key: AdminRole.SUPER_ADMIN,
    name: "Super Admin",
    icon: ShieldCheckIcon,
    badgeStyle: {},
    iconStyle: {},
    description:
      "Full administrative access to all platform features and settings. Can manage all users, configure system settings, and oversee all operations.",
  },
};

function formatRoleKey(roleKey: string): string {
  return roleKey
    .split("_")
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(" ");
}

function normalizeHexColor(
  color: string | null | undefined,
  fallback: AdminRoleBadgeColor = DEFAULT_ADMIN_ROLE_BADGE_COLOR
): AdminRoleBadgeColor {
  if (!color) {
    return fallback;
  }

  const trimmed = color.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed.toUpperCase() as AdminRoleBadgeColor;
  }

  return fallback;
}

function hexToRgb(color: AdminRoleBadgeColor) {
  return {
    r: Number.parseInt(color.slice(1, 3), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    b: Number.parseInt(color.slice(5, 7), 16),
  };
}

export function getAdminRoleBadgeStyles(
  color: string | null | undefined
): {
  badgeColor: AdminRoleBadgeColor;
  badgeStyle: CSSProperties;
  iconStyle: CSSProperties;
} {
  const badgeColor = normalizeHexColor(color);
  const rgb = hexToRgb(badgeColor);

  return {
    badgeColor,
    badgeStyle: {
      backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`,
      borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.28)`,
      color: "hsl(var(--foreground))",
    },
    iconStyle: {
      color: badgeColor,
    },
  };
}

export function getAdminRoleDisplayInfo(
  roleKey: AdminRoleKey,
  fallbackName?: string | null,
  fallbackDescription?: string | null,
  badgeColor?: AdminRoleBadgeColor | null
): AdminRoleDisplayInfo {
  const styles = getAdminRoleBadgeStyles(
    badgeColor ?? (roleKey === AdminRole.SUPER_ADMIN ? SUPER_ADMIN_BADGE_COLOR : undefined)
  );
  const seededDisplay = SEEDED_ROLE_DISPLAY[roleKey];
  if (seededDisplay) {
    return {
      ...seededDisplay,
      badgeColor: styles.badgeColor,
      badgeStyle: styles.badgeStyle,
      iconStyle: styles.iconStyle,
    };
  }

  return {
    key: roleKey,
    name: fallbackName?.trim() || formatRoleKey(roleKey),
    badgeColor: styles.badgeColor,
    icon: CogIcon,
    badgeStyle: styles.badgeStyle,
    iconStyle: styles.iconStyle,
    description:
      fallbackDescription?.trim() ||
      "Admin role with a tailored permission set.",
  };
}
