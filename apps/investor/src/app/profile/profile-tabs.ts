export {
  PROFILE_PATH,
  PROFILE_TAB_PROFILE,
  PROFILE_TAB_BANKING,
  PROFILE_TAB_PEOPLE,
  PROFILE_TAB_DOCUMENTS,
  PROFILE_BANKING_HREF,
  PROFILE_PEOPLE_HREF,
} from "@cashsouk/types";
import {
  isOrganisationProfileTab,
  organisationProfileTabFromSearchParam,
  type OrganisationProfileTab,
} from "@cashsouk/types";

export type ProfileTab = OrganisationProfileTab;

export function isProfileTab(
  value: string | null | undefined,
  isCompany = false
): value is ProfileTab {
  return isOrganisationProfileTab(value, isCompany);
}

export function profileTabFromSearchParam(
  tab: string | null,
  isCompany = false
): ProfileTab {
  return organisationProfileTabFromSearchParam(tab, isCompany);
}
