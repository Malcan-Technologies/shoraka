export type DirectorShareholderAlertCopy = {
  title: string;
  description: string;
  ctaLabel: string;
};

export const ISSUER_DIRECTOR_SHAREHOLDER_ALERT_COPY: DirectorShareholderAlertCopy = {
  title: "Action required: directors and shareholders onboarding",
  description:
    "Some directors or shareholders have not finished onboarding. Complete onboarding on your company profile before you submit an application.",
  ctaLabel: "Go to Profile",
};

export const INVESTOR_DIRECTOR_SHAREHOLDER_ALERT_COPY: DirectorShareholderAlertCopy = {
  title: "Action required: directors and shareholders onboarding",
  description:
    "Some directors or shareholders have not finished onboarding or verification. Please complete the required steps on your company profile.",
  ctaLabel: "Go to Profile",
};
