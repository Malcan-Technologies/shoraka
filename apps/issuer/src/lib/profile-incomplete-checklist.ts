import {
  groupIssuerMissingByProfileSection,
  issuerUiSectionForMissing,
  type ProfileMissingItem,
  type ProfileUiSectionId,
} from "@cashsouk/types";

export type IssuerProfileIncompleteChecklistItem = {
  label: string;
  personName?: string | null;
};

export type IssuerProfileIncompleteChecklistSection = {
  id: ProfileUiSectionId;
  label: string;
  href: string;
  missingCount: number;
  items: IssuerProfileIncompleteChecklistItem[];
};

export type IssuerProfileIncompleteChecklistModel = {
  percent: number;
  complete: boolean;
  missingCount: number;
  sections: IssuerProfileIncompleteChecklistSection[];
};

export function buildIssuerProfileSectionLink(section: {
  id: ProfileUiSectionId;
  href: string;
}): string {
  // People & Access lives under the `people` tab; the rest live under `profile`.
  const tab = section.id === "people" ? "people" : "profile";
  return `/profile?tab=${tab}${section.href}`;
}

export function buildIssuerProfileIncompleteChecklistModel(
  input: {
    complete: boolean;
    percent: number;
    missing: ProfileMissingItem[];
  }
): IssuerProfileIncompleteChecklistModel {
  const sectionsById = new Map<ProfileUiSectionId, IssuerProfileIncompleteChecklistSection>();

  const groupedSections = groupIssuerMissingByProfileSection(input.missing);
  for (const s of groupedSections) {
    sectionsById.set(s.id, {
      id: s.id,
      label: s.label,
      href: s.href,
      missingCount: s.missingCount,
      items: [],
    });
  }

  for (const missingItem of input.missing) {
    const id = issuerUiSectionForMissing(missingItem);
    const section = sectionsById.get(id);
    if (!section) continue;
    section.items.push({
      label: missingItem.label,
      personName: missingItem.partyName ?? null,
    });
  }

  const sections = [...sectionsById.values()].filter((s) => s.missingCount > 0);
  return {
    complete: input.complete,
    percent: input.percent,
    missingCount: input.missing.length,
    sections,
  };
}

