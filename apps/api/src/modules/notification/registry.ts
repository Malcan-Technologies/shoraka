/**
 * Registry of all system notification types to ensure type safety
 * when sending notifications from various services.
 */
export const NotificationTypeIds = {
  // System / Onboarding
  ORGANIZATION_APPROVED: 'organization_approved',
  ORGANIZATION_REJECTED: 'organization_rejected',
  KYC_APPROVED: 'kyc_approved',
  KYC_REJECTED: 'kyc_rejected',

  // Authentication
  PASSWORD_CHANGED: 'password_changed',
  LOGIN_NEW_DEVICE: 'login_new_device',

  // Marketing / Generic
  SYSTEM_ANNOUNCEMENT: 'system_announcement',
  NEW_PRODUCT_ALERT: 'new_product_alert',
} as const;

export type NotificationTypeId = typeof NotificationTypeIds[keyof typeof NotificationTypeIds];

/**
 * Define the payload data required for each notification type
 */
export interface NotificationPayloads {
  [NotificationTypeIds.ORGANIZATION_APPROVED]: {
    onboardingType: string;
    orgName: string;
    portalType: 'investor' | 'issuer';
  };
  [NotificationTypeIds.ORGANIZATION_REJECTED]: {
    onboardingType: string;
    orgName: string;
    reason?: string;
  };
  [NotificationTypeIds.KYC_APPROVED]: {
    userName: string;
  };
  [NotificationTypeIds.KYC_REJECTED]: {
    userName: string;
    reason?: string;
  };
  [NotificationTypeIds.PASSWORD_CHANGED]: {
    changedAt: Date;
  };
  [NotificationTypeIds.LOGIN_NEW_DEVICE]: {
    deviceName: string;
    location: string;
    time: Date;
  };
  [NotificationTypeIds.SYSTEM_ANNOUNCEMENT]: {
    title: string;
    message: string;
  };
  [NotificationTypeIds.NEW_PRODUCT_ALERT]: {
    productName: string;
    productId: string;
  };
}

/**
 * Template structure for a notification
 */
export interface NotificationTemplate<T extends NotificationTypeId> {
  title: string | ((data: NotificationPayloads[T]) => string);
  message: (data: NotificationPayloads[T]) => string;
  linkPath: (data: NotificationPayloads[T]) => string;
}

/**
 * Central registry of notification templates
 */
export const NOTIFICATION_TEMPLATES: {
  [T in NotificationTypeId]: NotificationTemplate<T>;
} = {
  [NotificationTypeIds.ORGANIZATION_APPROVED]: {
    title: 'Onboarding Completed',
    message: (data) =>
      `Congratulations! Your ${data.onboardingType.toLowerCase()} onboarding for ${data.orgName} has been completed successfully. You now have full access to the platform.`,
    linkPath: (data) =>
      data.portalType === 'investor' ? '/dashboard' : '/issuer/dashboard',
  },
  [NotificationTypeIds.ORGANIZATION_REJECTED]: {
    title: 'Organization Application Rejected',
    message: (data) =>
      `Unfortunately, your ${data.onboardingType.toLowerCase()} onboarding for ${data.orgName} was rejected.${data.reason ? ` Reason: ${data.reason}` : ''}`,
    linkPath: () => '/onboarding',
  },
  [NotificationTypeIds.KYC_APPROVED]: {
    title: 'Identity Verification Approved',
    message: (data) => `Hello ${data.userName}, your identity verification has been approved.`,
    linkPath: () => '/account',
  },
  [NotificationTypeIds.KYC_REJECTED]: {
    title: 'Identity Verification Rejected',
    message: (data) => `Hello ${data.userName}, your identity verification was rejected.${data.reason ? ` Reason: ${data.reason}` : ''}`,
    linkPath: () => '/account',
  },
  [NotificationTypeIds.PASSWORD_CHANGED]: {
    title: 'Password Changed',
    message: (data) => `The password for your account was changed on ${data.changedAt.toLocaleString()}.`,
    linkPath: () => '/account',
  },
  [NotificationTypeIds.LOGIN_NEW_DEVICE]: {
    title: 'Login from New Device',
    message: (data) => `A new login was detected on ${data.deviceName} from ${data.location} at ${data.time.toLocaleString()}.`,
    linkPath: () => '/account',
  },
  [NotificationTypeIds.SYSTEM_ANNOUNCEMENT]: {
    title: (data) => data.title,
    message: (data) => data.message,
    linkPath: () => '/',
  },
  [NotificationTypeIds.NEW_PRODUCT_ALERT]: {
    title: 'New Investment Opportunity',
    message: (data) => `A new product "${data.productName}" is now available for investment.`,
    linkPath: (data) => `/investments/${data.productId}`,
  },
};

/**
 * Helper to get notification content from the registry
 */
export function getNotificationContent<T extends NotificationTypeId>(
  typeId: T,
  data: NotificationPayloads[T]
) {
  const template = NOTIFICATION_TEMPLATES[typeId];
  return {
    title: typeof template.title === 'function' ? (template.title as Function)(data) : template.title,
    message: template.message(data),
    linkPath: template.linkPath(data),
  };
}
