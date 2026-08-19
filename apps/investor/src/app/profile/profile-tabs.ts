export const PROFILE_PATH = "/profile";
export const PROFILE_TAB_PROFILE = "profile";
export const PROFILE_TAB_BANKING = "banking";
export const PROFILE_TAB_DOCUMENTS = "documents";

export const PROFILE_TABS = [
  PROFILE_TAB_PROFILE,
  PROFILE_TAB_BANKING,
  PROFILE_TAB_DOCUMENTS,
] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

export const PROFILE_BANKING_HREF = `${PROFILE_PATH}?tab=${PROFILE_TAB_BANKING}`;

export function isProfileTab(value: string | null | undefined): value is ProfileTab {
  return (
    value === PROFILE_TAB_PROFILE ||
    value === PROFILE_TAB_BANKING ||
    value === PROFILE_TAB_DOCUMENTS
  );
}

export function profileTabFromSearchParam(tab: string | null): ProfileTab {
  return isProfileTab(tab) ? tab : PROFILE_TAB_PROFILE;
}
