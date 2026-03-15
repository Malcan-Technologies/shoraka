export interface ReviewStatusPresentation {
  label: string;
  badgeClass: string;
  iconClass: string;
  dotClass: string;
}

const STATUS_PRESENTATION: Record<string, ReviewStatusPresentation> = {
  SUBMITTED: {
    label: "Submitted",
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-foreground",
    iconClass: "text-blue-600",
    dotClass: "bg-blue-500",
  },
  UNDER_REVIEW: {
    label: "Under Review",
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-foreground",
    iconClass: "text-blue-600",
    dotClass: "bg-blue-500",
  },
  RESUBMITTED: {
    label: "Resubmitted",
    badgeClass: "border-orange-500/30 bg-orange-500/10 text-foreground",
    iconClass: "text-orange-600",
    dotClass: "bg-orange-500",
  },
  APPROVED: {
    label: "Approved",
    badgeClass: "border-green-500/30 bg-green-500/10 text-foreground",
    iconClass: "text-green-600",
    dotClass: "bg-green-500",
  },
  REJECTED: {
    label: "Rejected",
    badgeClass: "border-red-500/30 bg-red-500/10 text-foreground",
    iconClass: "text-red-600",
    dotClass: "bg-destructive",
  },
  AMENDMENT_REQUESTED: {
    label: "Amendment Requested",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-foreground",
    iconClass: "text-amber-600",
    dotClass: "bg-amber-500",
  },
  DRAFT: {
    label: "Draft",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-foreground",
    iconClass: "text-amber-600",
    dotClass: "bg-amber-500",
  },
  ARCHIVED: {
    label: "Archived",
    badgeClass: "border-slate-500/30 bg-slate-500/10 text-foreground",
    iconClass: "text-slate-600",
    dotClass: "bg-slate-500",
  },
  PENDING: {
    label: "Pending",
    badgeClass: "border-muted-foreground/30 bg-muted/60 text-muted-foreground",
    iconClass: "text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
  WITHDRAWN: {
    label: "Withdrawn",
    badgeClass: "border-slate-600/40 bg-slate-700/25 text-slate-800 dark:bg-slate-600/30 dark:text-slate-200",
    iconClass: "text-slate-700 dark:text-slate-300",
    dotClass: "bg-slate-600",
  },
  OFFER_SENT: {
    label: "Offer Sent",
    badgeClass: "border-blue-500/30 bg-blue-500/10 text-foreground",
    iconClass: "text-blue-600",
    dotClass: "bg-blue-500",
  },
};

function toLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getReviewStatusPresentation(status: string): ReviewStatusPresentation {
  return (
    STATUS_PRESENTATION[status] ?? {
      ...STATUS_PRESENTATION.PENDING,
      label: toLabel(status),
    }
  );
}
