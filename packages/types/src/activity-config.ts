export type ActivityDomain = "onboarding" | "application" | "note";
export type ActivityPortal = "investor" | "issuer";

export interface ActivityDomainConfig {
  label: string;
  filterable: boolean;
  portals: ActivityPortal[];
}

export const ACTIVITY_DOMAIN_CONFIG: Record<ActivityDomain, ActivityDomainConfig> = {
  onboarding: {
    label: "Onboarding",
    filterable: true,
    portals: ["investor", "issuer"],
  },
  application: {
    label: "Application",
    filterable: true,
    portals: ["issuer"],
  },
  note: {
    label: "Note",
    filterable: false,
    portals: ["investor", "issuer"],
  },
};

export function getActivityDomainConfig(domain: ActivityDomain): ActivityDomainConfig {
  return ACTIVITY_DOMAIN_CONFIG[domain];
}

export function getFilterableActivityDomains(portal: ActivityPortal): ActivityDomain[] {
  return (Object.entries(ACTIVITY_DOMAIN_CONFIG) as Array<[ActivityDomain, ActivityDomainConfig]>)
    .filter(([, config]) => config.filterable && config.portals.includes(portal))
    .map(([domain]) => domain);
}
