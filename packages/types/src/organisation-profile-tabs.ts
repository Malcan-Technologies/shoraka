/**
 * Organisation page tabs (issuer + investor portals).
 * My Account stays at /account and is not part of this set.
 */
export const PROFILE_PATH = "/profile";
export const PROFILE_TAB_PROFILE = "profile";
export const PROFILE_TAB_BANKING = "banking";
export const PROFILE_TAB_PEOPLE = "people";
export const PROFILE_TAB_DOCUMENTS = "documents";

export const PERSONAL_ORGANISATION_TABS = [
  PROFILE_TAB_PROFILE,
  PROFILE_TAB_BANKING,
  PROFILE_TAB_DOCUMENTS,
] as const;

export const COMPANY_ORGANISATION_TABS = [
  PROFILE_TAB_PROFILE,
  PROFILE_TAB_BANKING,
  PROFILE_TAB_PEOPLE,
  PROFILE_TAB_DOCUMENTS,
] as const;

export type PersonalOrganisationTab = (typeof PERSONAL_ORGANISATION_TABS)[number];
export type CompanyOrganisationTab = (typeof COMPANY_ORGANISATION_TABS)[number];
export type OrganisationProfileTab = CompanyOrganisationTab;

export const PROFILE_BANKING_HREF = `${PROFILE_PATH}?tab=${PROFILE_TAB_BANKING}`;
export const PROFILE_PEOPLE_HREF = `${PROFILE_PATH}?tab=${PROFILE_TAB_PEOPLE}`;
export const PROFILE_DOCUMENTS_HREF = `${PROFILE_PATH}?tab=${PROFILE_TAB_DOCUMENTS}`;

export function organisationProfileTabs(isCompany: boolean): readonly OrganisationProfileTab[] {
  return isCompany ? COMPANY_ORGANISATION_TABS : PERSONAL_ORGANISATION_TABS;
}

export function isOrganisationProfileTab(
  value: string | null | undefined,
  isCompany: boolean
): value is OrganisationProfileTab {
  if (!value) return false;
  return (organisationProfileTabs(isCompany) as readonly string[]).includes(value);
}

export function organisationProfileTabFromSearchParam(
  tab: string | null | undefined,
  isCompany: boolean
): OrganisationProfileTab {
  return isOrganisationProfileTab(tab, isCompany) ? tab : PROFILE_TAB_PROFILE;
}
