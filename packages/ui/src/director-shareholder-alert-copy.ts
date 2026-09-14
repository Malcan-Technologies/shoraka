export type DirectorShareholderAlertCopy = {
  title: string;
  description: string;
  ctaLabel: string;
};

export const ISSUER_DIRECTOR_SHAREHOLDER_ALERT_COPY: DirectorShareholderAlertCopy = {
  title: "Action required: directors and shareholders onboarding",
  description:
    "Some directors or shareholders have not finished onboarding. Complete onboarding in People & Access before you submit an application.",
  ctaLabel: "Go to People & Access",
};

export const INVESTOR_DIRECTOR_SHAREHOLDER_ALERT_COPY: DirectorShareholderAlertCopy = {
  title: "Action required: directors and shareholders onboarding",
  description:
    "Some directors or shareholders have not finished onboarding or verification. Complete the remaining steps in People & Access.",
  ctaLabel: "Go to People & Access",
};
