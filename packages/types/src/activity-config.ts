export type ActivityDomain = "onboarding" | "application" | "note";

export interface ActivityDomainConfig {
  label: string;
  filterable: boolean;
}

export const ACTIVITY_DOMAIN_CONFIG: Record<ActivityDomain, ActivityDomainConfig> = {
  onboarding: {
    label: "Onboarding",
    filterable: true,
  },
  application: {
    label: "Application",
    filterable: true,
  },
  note: {
    label: "Note",
    filterable: false,
  },
};

export function getActivityDomainConfig(domain: ActivityDomain): ActivityDomainConfig {
  return ACTIVITY_DOMAIN_CONFIG[domain];
}
