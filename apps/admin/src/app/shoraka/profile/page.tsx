"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BanknotesIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
  buildOperatorProfileCompleteness,
  OPERATOR_ADVISOR_TYPE_LABELS,
  OPERATOR_ADVISOR_TYPES,
  OPERATOR_HOLDER_TYPE_LABELS,
  OPERATOR_HOLDER_TYPES,
  operatorShareCapitalKind,
  ORGANIZATION_PARTY_ENTITY_TYPES,
  SC_ANNUAL_ADVISOR,
  SC_ANNUAL_FINANCIAL,
  SC_ANNUAL_GENERAL,
  SC_ANNUAL_INTEREST,
  SC_ANNUAL_OFFICER,
  SC_ANNUAL_PERSON_KIND_LABELS,
  SC_ANNUAL_SHARE_CAPITAL,
  SC_ANNUAL_SHAREHOLDER,
  SC_COMPANY_TYPE_LABELS,
  SC_COMPANY_TYPES,
  SC_DESIGNATION_LABELS,
  SC_DESIGNATIONS,
  SC_INTEREST_SHARE_TYPE_LABELS,
  SC_PERSON_KINDS,
  SC_SHARE_TYPE_LABELS,
  SC_SHARE_TYPES,
  type OperatorHolderType,
  type OperatorProfileDto,
  type ScCompanyType,
} from "@cashsouk/types";
import {
  ProfileCompletenessSummary,
  ProfileFieldGrid,
  ProfileReadField,
  StatusBadge,
} from "@cashsouk/ui";
import { Card, CardContent } from "@/components/ui/card";
import { RequirePermission } from "@/components/require-permission";
import { AdminPageHeader } from "@/components/admin-page-header";
import {
  AdminCardEditActions,
  AdminDetailCardHeader,
  AdminDetailTabPanel,
  AdminDetailTabs,
  useAdminDetailTabState,
} from "@/components/admin-detail";
import { usePermissions } from "@/hooks/use-permissions";
import {
  emptyCapital,
  financialYearLabel,
  formatProfileDate,
  ShorakaCountrySelect,
  ShorakaEnumSelect,
  ShorakaField,
  ShorakaYesNo,
  toDateInput,
} from "./shoraka-profile-fields";
import {
  shorakaAdvisorPayload,
  shorakaFinancialPayload,
  shorakaInterestPayload,
  shorakaOfficerPayload,
  shorakaShareCapitalPayload,
  shorakaShareholderPayload,
} from "./shoraka-profile-payload";
import { ShorakaRecordSection } from "./shoraka-record-section";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const SHORAKA_TABS = [
  "general",
  "capital",
  "holders",
  "officers",
  "advisors",
  "interests",
  "financials",
] as const;
type ShorakaTab = (typeof SHORAKA_TABS)[number];

function isShorakaTab(value: string): value is ShorakaTab {
  return (SHORAKA_TABS as readonly string[]).includes(value);
}

const HOLDER_FILTERS = [
  { id: "all", label: "All" },
  { id: "SHAREHOLDER", label: "Shareholders" },
  { id: "MEMBER", label: "Members" },
  { id: "BENEFICIAL_OWNER", label: "Beneficial Owners" },
] as const;

const COMPLETENESS_ROWS: Array<{
  id: "general" | "shareCapital" | "shareholders" | "officers" | "financials";
  label: string;
  tab: ShorakaTab;
}> = [
  { id: "general", label: "General Information", tab: "general" },
  { id: "shareCapital", label: "Share Capital", tab: "capital" },
  { id: "shareholders", label: "Ownership", tab: "holders" },
  { id: "officers", label: "Board & Management", tab: "officers" },
  { id: "financials", label: "Financial Statements", tab: "financials" },
];

export default function RmoProfilePage() {
  const { can } = usePermissions();
  const canManage = can("platform_settings.manage");
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const [holderFilter, setHolderFilter] = React.useState("all");

  const query = useQuery({
    queryKey: ["admin", "operator-profile"],
    queryFn: async () => {
      const res = await api.getOperatorProfile();
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (next: OperatorProfileDto) => {
      const res = await api.patchOperatorProfile({
        name: next.name,
        registrationNumber: next.registrationNumber,
        trusteeRegistrationNumber: next.trusteeRegistrationNumber,
        scCompanyType: next.scCompanyType,
        responsiblePersonName: next.responsiblePersonName,
        responsiblePersonPhone: next.responsiblePersonPhone,
      });
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["admin", "operator-profile"], data);
      toast.success("Shoraka profile saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const capitalMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await api.patchOperatorShareCapital(body);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["admin", "operator-profile"], data);
      toast.success("Share capital saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [draft, setDraft] = React.useState<OperatorProfileDto | null>(null);
  const [editingSection, setEditingSection] = React.useState<"general" | "capital" | null>(null);
  React.useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  const completeness = draft ? buildOperatorProfileCompleteness(draft) : null;
  const { activeTab, setActiveTab } = useAdminDetailTabState<ShorakaTab>({
    isValidTab: isShorakaTab,
    computedTab: "general",
  });
  const resolvedTab = activeTab ?? "general";

  if (!draft || !completeness) {
    return (
      <RequirePermission permission="platform_settings.view">
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="w-full space-y-6 px-2 py-8 md:px-4">
            <AdminPageHeader title="Shoraka Profile" />
            <p className="text-ui text-muted-foreground">Loading…</p>
          </div>
        </div>
      </RequirePermission>
    );
  }

  const cap = draft.shareCapital;
  const capitalKind = operatorShareCapitalKind(draft.scCompanyType);
  const generalMissing = new Set(
    completeness.missing.filter((item) => item.section === "general").map((item) => item.field)
  );
  const capitalMissing = new Set(
    completeness.missing.filter((item) => item.section === "shareCapital").map((item) => item.field)
  );
  const sectionById = new Map(completeness.sections.map((section) => [section.id, section]));
  const completenessRows = COMPLETENESS_ROWS.filter((row) => {
    if (row.id === "shareCapital" && !capitalKind) return false;
    return true;
  }).map((row) => {
    const section = sectionById.get(row.id);
    const missingCount = section?.missing.length ?? 0;
    return {
      id: row.id,
      label: row.label,
      href: `#shoraka-${row.tab}`,
      missingCount,
      complete: section?.complete ?? missingCount === 0,
    };
  });
  const tabStatus = (tab: ShorakaTab) => {
    const row = COMPLETENESS_ROWS.find((item) => item.tab === tab);
    if (!row) return undefined;
    const section = sectionById.get(row.id);
    if (!section || section.complete) return undefined;
    return { statusToken: "action" as const, statusLabel: "Needs action" };
  };

  const filteredHolders =
    holderFilter === "all"
      ? draft.shareholders
      : draft.shareholders.filter((row) => row.holderType === holderFilter);

  const goToTab = (tab: ShorakaTab) => {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      document.getElementById(`shoraka-${tab}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <RequirePermission permission="platform_settings.view">
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="w-full space-y-6 px-2 py-8 md:px-4">
        <AdminPageHeader
          title="Shoraka Profile"
          description="CashSouk/Shoraka operator master profile used for regulatory reporting."
        />

        <Card className="rounded-2xl">
          <AdminDetailCardHeader
            icon={ClipboardDocumentCheckIcon}
            title="Profile completeness"
            description="Profile completeness covers core master data used by the platform. Report-specific and condition-dependent fields are validated separately."
          />
          <CardContent>
            <ProfileCompletenessSummary
              percent={completeness.percent}
              remaining={completeness.missing.length}
              sections={completenessRows}
              showCompleteSections
              onSectionClick={(section) => {
                const row = COMPLETENESS_ROWS.find((item) => item.id === section.id);
                if (row) goToTab(row.tab);
              }}
            />
          </CardContent>
        </Card>

        <AdminDetailTabs
          tabs={[
            { id: "general", label: "General", ...tabStatus("general") },
            { id: "capital", label: "Share Capital", ...tabStatus("capital") },
            { id: "holders", label: "Ownership", ...tabStatus("holders") },
            { id: "officers", label: "Board & Management", ...tabStatus("officers") },
            { id: "advisors", label: "Advisers" },
            { id: "interests", label: "Other Companies" },
            { id: "financials", label: "Financial Statements", ...tabStatus("financials") },
          ]}
          value={resolvedTab}
          onValueChange={setActiveTab}
        >
          <AdminDetailTabPanel value="general">
            <Card id="shoraka-general" className="scroll-mt-24 rounded-2xl">
              <AdminDetailCardHeader
                icon={BuildingOffice2Icon}
                title="General Information"
                description="RMO / operator identity used on the master record"
                actions={
                  <AdminCardEditActions
                    canEdit={canManage}
                    isEditing={editingSection === "general"}
                    canSave
                    isSaving={saveMutation.isPending}
                    onEdit={() => setEditingSection("general")}
                    onCancel={() => {
                      if (query.data) setDraft(query.data);
                      setEditingSection(null);
                    }}
                    onSave={() => {
                      saveMutation.mutate(draft, { onSuccess: () => setEditingSection(null) });
                    }}
                  />
                }
              />
              <CardContent>
                {editingSection === "general" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <ShorakaField
                      label={SC_ANNUAL_GENERAL.nameOfRmo.label}
                      value={draft.name ?? ""}
                      onChange={(v) => setDraft({ ...draft, name: v })}
                      help={SC_ANNUAL_GENERAL.nameOfRmo.help}
                      required
                    />
                    <ShorakaField
                      label={SC_ANNUAL_GENERAL.companyRegistrationNumber.label}
                      value={draft.registrationNumber ?? ""}
                      onChange={(v) => setDraft({ ...draft, registrationNumber: v })}
                      help={SC_ANNUAL_GENERAL.companyRegistrationNumber.help}
                      required
                    />
                    <ShorakaEnumSelect
                      label={SC_ANNUAL_GENERAL.typeOfCompany.label}
                      value={draft.scCompanyType ?? ""}
                      options={SC_COMPANY_TYPES}
                      labels={SC_COMPANY_TYPE_LABELS}
                      onChange={(v: ScCompanyType) => setDraft({ ...draft, scCompanyType: v })}
                      help={SC_ANNUAL_GENERAL.typeOfCompany.help}
                      required
                    />
                    <ShorakaField
                      label={SC_ANNUAL_GENERAL.trusteeCompanyRegistrationNumber.label}
                      value={draft.trusteeRegistrationNumber ?? ""}
                      onChange={(v) => setDraft({ ...draft, trusteeRegistrationNumber: v })}
                      help={SC_ANNUAL_GENERAL.trusteeCompanyRegistrationNumber.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_GENERAL.nameOfResponsiblePerson.label}
                      value={draft.responsiblePersonName ?? ""}
                      onChange={(v) => setDraft({ ...draft, responsiblePersonName: v })}
                      help={SC_ANNUAL_GENERAL.nameOfResponsiblePerson.help}
                      required
                    />
                    <ShorakaField
                      label={SC_ANNUAL_GENERAL.contactNumber.label}
                      value={draft.responsiblePersonPhone ?? ""}
                      onChange={(v) => setDraft({ ...draft, responsiblePersonPhone: v })}
                      help={SC_ANNUAL_GENERAL.contactNumber.help}
                      required
                    />
                  </div>
                ) : (
                  <ProfileFieldGrid>
                    <ProfileReadField
                      label={SC_ANNUAL_GENERAL.nameOfRmo.label}
                      value={draft.name}
                      missing={generalMissing.has("name")}
                      required
                      help={SC_ANNUAL_GENERAL.nameOfRmo.help}
                    />
                    <ProfileReadField
                      label={SC_ANNUAL_GENERAL.companyRegistrationNumber.label}
                      value={draft.registrationNumber}
                      missing={generalMissing.has("registrationNumber")}
                      required
                      help={SC_ANNUAL_GENERAL.companyRegistrationNumber.help}
                    />
                    <ProfileReadField
                      label={SC_ANNUAL_GENERAL.typeOfCompany.label}
                      value={
                        draft.scCompanyType
                          ? SC_COMPANY_TYPE_LABELS[draft.scCompanyType]
                          : draft.scCompanyType
                      }
                      missing={generalMissing.has("scCompanyType")}
                      required
                      help={SC_ANNUAL_GENERAL.typeOfCompany.help}
                    />
                    <ProfileReadField
                      label={SC_ANNUAL_GENERAL.trusteeCompanyRegistrationNumber.label}
                      value={draft.trusteeRegistrationNumber}
                      help={SC_ANNUAL_GENERAL.trusteeCompanyRegistrationNumber.help}
                    />
                    <ProfileReadField
                      label={SC_ANNUAL_GENERAL.nameOfResponsiblePerson.label}
                      value={draft.responsiblePersonName}
                      missing={generalMissing.has("responsiblePersonName")}
                      required
                      help={SC_ANNUAL_GENERAL.nameOfResponsiblePerson.help}
                    />
                    <ProfileReadField
                      label={SC_ANNUAL_GENERAL.contactNumber.label}
                      value={draft.responsiblePersonPhone}
                      missing={generalMissing.has("responsiblePersonPhone")}
                      required
                      help={SC_ANNUAL_GENERAL.contactNumber.help}
                    />
                  </ProfileFieldGrid>
                )}
              </CardContent>
            </Card>
          </AdminDetailTabPanel>

          <AdminDetailTabPanel value="capital">
            <Card id="shoraka-capital" className="scroll-mt-24 rounded-2xl">
              <AdminDetailCardHeader
                icon={BanknotesIcon}
                title="Share Capital"
                description="[02000] Summary of Share Capital"
                actions={
                  <AdminCardEditActions
                    canEdit={canManage && Boolean(capitalKind)}
                    isEditing={editingSection === "capital"}
                    canSave
                    isSaving={capitalMutation.isPending}
                    onEdit={() => setEditingSection("capital")}
                    onCancel={() => {
                      if (query.data) setDraft(query.data);
                      setEditingSection(null);
                    }}
                    onSave={() => {
                      if (!capitalKind) return;
                      capitalMutation.mutate(
                        shorakaShareCapitalPayload(
                          (draft.shareCapital ?? emptyCapital()) as unknown as Record<string, unknown>,
                          capitalKind
                        ),
                        { onSuccess: () => setEditingSection(null) }
                      );
                    }}
                  />
                }
              />
              <CardContent className="space-y-6">
                {!capitalKind ? (
                  <p className="text-ui text-muted-foreground">
                    {draft.scCompanyType
                      ? "The SC [02000] table defines a Sdn Bhd block and a Limited Liability Partnership block. This Type of Company is not mapped to either block."
                      : "Confirm Type of Company in General before entering share-capital fields. The SC [02000] table defines a Sdn Bhd block and a Limited Liability Partnership block."}
                  </p>
                ) : null}
                {capitalKind === "SDN_BHD" ? (
                  editingSection === "capital" ? (
                    <>
                      <ShareGroup title={SC_ANNUAL_SHARE_CAPITAL.ordinaryForSdnBhd.label}>
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.noOfShares.label}
                          value={cap?.ordinaryUnits ?? ""}
                          integer
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), ordinaryUnits: v },
                            })
                          }
                          help={SC_ANNUAL_SHARE_CAPITAL.noOfShares.help}
                        />
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.nominalValueRm.label}
                          value={cap?.ordinaryAmount ?? ""}
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), ordinaryAmount: v },
                            })
                          }
                        />
                      </ShareGroup>
                      <ShareGroup title={SC_ANNUAL_SHARE_CAPITAL.preferenceForSdnBhd.label}>
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.noOfShares.label}
                          value={cap?.preferenceUnits ?? ""}
                          integer
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), preferenceUnits: v },
                            })
                          }
                          help={SC_ANNUAL_SHARE_CAPITAL.noOfShares.help}
                        />
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.nominalValueRm.label}
                          value={cap?.preferenceAmount ?? ""}
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), preferenceAmount: v },
                            })
                          }
                        />
                      </ShareGroup>
                      <ShareGroup title={SC_ANNUAL_SHARE_CAPITAL.othersForSdnBhd.label}>
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.noOfShares.label}
                          value={cap?.othersUnits ?? ""}
                          integer
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), othersUnits: v },
                            })
                          }
                          help={SC_ANNUAL_SHARE_CAPITAL.noOfShares.help}
                        />
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.nominalValueRm.label}
                          value={cap?.othersAmount ?? ""}
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), othersAmount: v },
                            })
                          }
                        />
                      </ShareGroup>
                      <ProfileFieldGrid>
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.totalPaidUpCapitalForSdnBhd.label}
                          value={cap?.totalPaidUpCapital ?? ""}
                          integer
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), totalPaidUpCapital: v },
                            })
                          }
                          help={SC_ANNUAL_SHARE_CAPITAL.totalPaidUpCapitalForSdnBhd.help}
                          required
                        />
                      </ProfileFieldGrid>
                    </>
                  ) : (
                    <>
                      <ShareGroup title={SC_ANNUAL_SHARE_CAPITAL.ordinaryForSdnBhd.label}>
                        <ProfileReadField label={SC_ANNUAL_SHARE_CAPITAL.noOfShares.label} value={cap?.ordinaryUnits} />
                        <ProfileReadField label={SC_ANNUAL_SHARE_CAPITAL.nominalValueRm.label} value={cap?.ordinaryAmount} />
                      </ShareGroup>
                      <ShareGroup title={SC_ANNUAL_SHARE_CAPITAL.preferenceForSdnBhd.label}>
                        <ProfileReadField label={SC_ANNUAL_SHARE_CAPITAL.noOfShares.label} value={cap?.preferenceUnits} />
                        <ProfileReadField label={SC_ANNUAL_SHARE_CAPITAL.nominalValueRm.label} value={cap?.preferenceAmount} />
                      </ShareGroup>
                      <ShareGroup title={SC_ANNUAL_SHARE_CAPITAL.othersForSdnBhd.label}>
                        <ProfileReadField label={SC_ANNUAL_SHARE_CAPITAL.noOfShares.label} value={cap?.othersUnits} />
                        <ProfileReadField label={SC_ANNUAL_SHARE_CAPITAL.nominalValueRm.label} value={cap?.othersAmount} />
                      </ShareGroup>
                      <ProfileFieldGrid>
                        <ProfileReadField
                          label={SC_ANNUAL_SHARE_CAPITAL.totalPaidUpCapitalForSdnBhd.label}
                          value={cap?.totalPaidUpCapital}
                          missing={capitalMissing.has("totalPaidUpCapital")}
                          required
                          help={SC_ANNUAL_SHARE_CAPITAL.totalPaidUpCapitalForSdnBhd.help}
                        />
                      </ProfileFieldGrid>
                    </>
                  )
                ) : null}
                {capitalKind === "LLP" ? (
                  editingSection === "capital" ? (
                    <div className="space-y-6">
                      <p className="text-ui font-medium">{SC_ANNUAL_SHARE_CAPITAL.limitedLiabilityPartnership.label}</p>
                      <ShareGroup title={SC_ANNUAL_SHARE_CAPITAL.membersCapital.label}>
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.noOfShares.label}
                          value={cap?.llpMembersCapitalUnits ?? ""}
                          integer
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), llpMembersCapitalUnits: v },
                            })
                          }
                          help={SC_ANNUAL_SHARE_CAPITAL.membersCapital.help}
                        />
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.nominalValueRm.label}
                          value={cap?.llpMembersCapitalAmount ?? ""}
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), llpMembersCapitalAmount: v },
                            })
                          }
                        />
                      </ShareGroup>
                      <ShareGroup title={SC_ANNUAL_SHARE_CAPITAL.membersReserves.label}>
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.noOfShares.label}
                          value={cap?.llpMembersReservesUnits ?? ""}
                          integer
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), llpMembersReservesUnits: v },
                            })
                          }
                          help={SC_ANNUAL_SHARE_CAPITAL.membersReserves.help}
                        />
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.nominalValueRm.label}
                          value={cap?.llpMembersReservesAmount ?? ""}
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), llpMembersReservesAmount: v },
                            })
                          }
                        />
                      </ShareGroup>
                      <ShareGroup title={SC_ANNUAL_SHARE_CAPITAL.subordinatedLoans.label}>
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.noOfShares.label}
                          value={cap?.llpSubordinatedLoansUnits ?? ""}
                          integer
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), llpSubordinatedLoansUnits: v },
                            })
                          }
                          help={SC_ANNUAL_SHARE_CAPITAL.subordinatedLoans.help}
                        />
                        <ShorakaField
                          label={SC_ANNUAL_SHARE_CAPITAL.nominalValueRm.label}
                          value={cap?.llpSubordinatedLoansAmount ?? ""}
                          onChange={(v) =>
                            setDraft({
                              ...draft,
                              shareCapital: { ...(cap ?? emptyCapital()), llpSubordinatedLoansAmount: v },
                            })
                          }
                        />
                      </ShareGroup>
                      <ShorakaField
                        label={SC_ANNUAL_SHARE_CAPITAL.totalLimitedLiabilityPartnership.label}
                        value={cap?.totalLlp ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), totalLlp: v },
                          })
                        }
                        help={SC_ANNUAL_SHARE_CAPITAL.totalLimitedLiabilityPartnership.help}
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <p className="text-ui font-medium">{SC_ANNUAL_SHARE_CAPITAL.limitedLiabilityPartnership.label}</p>
                      <ShareGroup title={SC_ANNUAL_SHARE_CAPITAL.membersCapital.label}>
                        <ProfileReadField
                          label={SC_ANNUAL_SHARE_CAPITAL.noOfShares.label}
                          value={cap?.llpMembersCapitalUnits}
                          help={SC_ANNUAL_SHARE_CAPITAL.membersCapital.help}
                        />
                        <ProfileReadField
                          label={SC_ANNUAL_SHARE_CAPITAL.nominalValueRm.label}
                          value={cap?.llpMembersCapitalAmount}
                        />
                      </ShareGroup>
                      <ShareGroup title={SC_ANNUAL_SHARE_CAPITAL.membersReserves.label}>
                        <ProfileReadField
                          label={SC_ANNUAL_SHARE_CAPITAL.noOfShares.label}
                          value={cap?.llpMembersReservesUnits}
                          help={SC_ANNUAL_SHARE_CAPITAL.membersReserves.help}
                        />
                        <ProfileReadField
                          label={SC_ANNUAL_SHARE_CAPITAL.nominalValueRm.label}
                          value={cap?.llpMembersReservesAmount}
                        />
                      </ShareGroup>
                      <ShareGroup title={SC_ANNUAL_SHARE_CAPITAL.subordinatedLoans.label}>
                        <ProfileReadField
                          label={SC_ANNUAL_SHARE_CAPITAL.noOfShares.label}
                          value={cap?.llpSubordinatedLoansUnits}
                          help={SC_ANNUAL_SHARE_CAPITAL.subordinatedLoans.help}
                        />
                        <ProfileReadField
                          label={SC_ANNUAL_SHARE_CAPITAL.nominalValueRm.label}
                          value={cap?.llpSubordinatedLoansAmount}
                        />
                      </ShareGroup>
                      <ProfileFieldGrid>
                        <ProfileReadField
                          label={SC_ANNUAL_SHARE_CAPITAL.totalLimitedLiabilityPartnership.label}
                          value={cap?.totalLlp}
                          missing={capitalMissing.has("totalLlp")}
                          required
                          help={SC_ANNUAL_SHARE_CAPITAL.totalLimitedLiabilityPartnership.help}
                        />
                      </ProfileFieldGrid>
                    </div>
                  )
                ) : null}
              </CardContent>
            </Card>
          </AdminDetailTabPanel>

          <AdminDetailTabPanel value="holders">
            <div id="shoraka-holders" className="scroll-mt-24">
              <ShorakaRecordSection
                title="Ownership"
                description="Shareholders, members, and beneficial owners on the operator profile"
                icon={UserGroupIcon}
                addLabel="Add owner"
                emptyTitle="No ownership records yet"
                emptyMessage="Add Shoraka shareholders, members or beneficial owners used for the operator profile and regulatory reporting."
                rows={filteredHolders}
                canManage={canManage}
                filters={[...HOLDER_FILTERS]}
                filter={holderFilter}
                onFilterChange={setHolderFilter}
                renderCard={(row) => ({
                  title: row.name?.trim() || "Unnamed",
                  subtitle: [
                    OPERATOR_HOLDER_TYPE_LABELS[row.holderType],
                    row.entityType === "CORPORATE" ? "Company" : "Individual",
                    row.shareholdingPercentage ? `${row.shareholdingPercentage}%` : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                })}
                blank={() => ({
                  holderType: "SHAREHOLDER" as const,
                  entityType: "INDIVIDUAL" as const,
                  name: "",
                  identityNumber: "",
                  nationality: "",
                  address: "",
                })}
                dialogTitle={(mode) =>
                  mode === "add" ? "Add owner" : mode === "view" ? "Owner details" : "Edit owner"
                }
                onCreate={async (body) => {
                  const res = await api.createOperatorShareholder(shorakaShareholderPayload(body));
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onUpdate={async (id, body) => {
                  const res = await api.updateOperatorShareholder(id, shorakaShareholderPayload(body));
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onDelete={async (id) => {
                  const res = await api.deleteOperatorShareholder(id);
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                fields={(row, set, disabled) => (
                  <>
                    <ShorakaEnumSelect
                      label="Holder type"
                      value={row.holderType}
                      options={OPERATOR_HOLDER_TYPES}
                      labels={OPERATOR_HOLDER_TYPE_LABELS}
                      onChange={(v: OperatorHolderType) =>
                        set({
                          ...row,
                          holderType: v,
                          entityType: v === "BENEFICIAL_OWNER" ? "INDIVIDUAL" : row.entityType,
                        })
                      }
                      disabled={disabled}
                      required
                      help="CashSouk role on this row. The SC [03000] table covers Shareholders, Members and beneficial owners."
                    />
                    <ShorakaEnumSelect
                      label="Entity type"
                      value={row.entityType}
                      options={ORGANIZATION_PARTY_ENTITY_TYPES}
                      labels={{ INDIVIDUAL: "Individual", CORPORATE: "Company" }}
                      onChange={(v) => set({ ...row, entityType: v })}
                      disabled={disabled || row.holderType === "BENEFICIAL_OWNER"}
                      required
                      help="CashSouk selector used to apply the SC individual vs company/legal-entity definitions."
                    />
                    <ShorakaField
                      label={SC_ANNUAL_SHAREHOLDER.name.label}
                      value={row.name ?? ""}
                      onChange={(v) => set({ ...row, name: v })}
                      disabled={disabled}
                      required
                      help={SC_ANNUAL_SHAREHOLDER.name.help}
                    />
                    {row.entityType === "INDIVIDUAL" || row.holderType === "BENEFICIAL_OWNER" ? (
                      <ShorakaField
                        label={SC_ANNUAL_SHAREHOLDER.salutation.label}
                        value={row.salutation ?? ""}
                        onChange={(v) => set({ ...row, salutation: v })}
                        disabled={disabled}
                        help={SC_ANNUAL_SHAREHOLDER.salutation.help}
                      />
                    ) : null}
                    <ShorakaField
                      label={SC_ANNUAL_SHAREHOLDER.icPassportNumber.label}
                      value={row.identityNumber ?? ""}
                      onChange={(v) => set({ ...row, identityNumber: v })}
                      disabled={disabled}
                      required
                      help={SC_ANNUAL_SHAREHOLDER.icPassportNumber.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_SHAREHOLDER.dateOfBirth.label}
                      type="date"
                      value={toDateInput(
                        row.entityType === "CORPORATE" ? row.dateOfIncorporation : row.dateOfBirth
                      )}
                      onChange={(v) =>
                        set(
                          row.entityType === "CORPORATE"
                            ? { ...row, dateOfIncorporation: v, dateOfBirth: null }
                            : { ...row, dateOfBirth: v, dateOfIncorporation: null }
                        )
                      }
                      disabled={disabled}
                      help={SC_ANNUAL_SHAREHOLDER.dateOfBirth.help}
                    />
                    <ShorakaCountrySelect
                      label={SC_ANNUAL_SHAREHOLDER.nationality.label}
                      value={row.nationality ?? ""}
                      onChange={(v) => set({ ...row, nationality: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_SHAREHOLDER.nationality.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_SHAREHOLDER.address.label}
                      value={row.address ?? ""}
                      onChange={(v) => set({ ...row, address: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_SHAREHOLDER.address.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_SHAREHOLDER.dateAcquired.label}
                      type="date"
                      value={toDateInput(row.dateAcquired)}
                      onChange={(v) => set({ ...row, dateAcquired: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_SHAREHOLDER.dateAcquired.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_SHAREHOLDER.dateDisposal.label}
                      type="date"
                      value={toDateInput(row.dateDisposal)}
                      onChange={(v) => set({ ...row, dateDisposal: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_SHAREHOLDER.dateDisposal.help}
                    />
                    <ShorakaEnumSelect
                      label={SC_ANNUAL_SHAREHOLDER.typeOfShares.label}
                      value={row.shareType ?? ""}
                      options={SC_SHARE_TYPES}
                      labels={SC_SHARE_TYPE_LABELS}
                      onChange={(v) => set({ ...row, shareType: v })}
                      disabled={disabled}
                    />
                    {row.shareType === "OTHERS" ? (
                      <ShorakaField
                        label={SC_ANNUAL_SHAREHOLDER.typeOfSharesOthers.label}
                        value={row.shareTypeOther ?? ""}
                        onChange={(v) => set({ ...row, shareTypeOther: v })}
                        disabled={disabled}
                        required
                        help={SC_ANNUAL_SHAREHOLDER.typeOfSharesOthers.help}
                      />
                    ) : null}
                    <ShorakaField
                      label={SC_ANNUAL_SHAREHOLDER.shareholdingUnits.label}
                      value={row.shareholdingUnits ?? ""}
                      onChange={(v) => set({ ...row, shareholdingUnits: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_SHAREHOLDER.shareholdingAmount.label}
                      value={row.shareholdingAmount ?? ""}
                      onChange={(v) => set({ ...row, shareholdingAmount: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_SHAREHOLDER.shareholdingPercentage.label}
                      value={row.shareholdingPercentage ?? ""}
                      onChange={(v) => set({ ...row, shareholdingPercentage: v })}
                      disabled={disabled}
                    />
                  </>
                )}
              />
            </div>
          </AdminDetailTabPanel>

          <AdminDetailTabPanel value="officers">
            <div id="shoraka-officers" className="scroll-mt-24">
              <ShorakaRecordSection
                title="Board & Management"
                description="Directors, controllers, and authorised personnel for the operator"
                icon={UsersIcon}
                addLabel="Add person"
                emptyTitle="No board or management records yet"
                emptyMessage="Add Shoraka board or management people used for the operator profile and regulatory reporting."
                rows={draft.officers}
                canManage={canManage}
                renderCard={(row) => ({
                  title: row.name?.trim() || "Unnamed",
                  subtitle: [
                    SC_ANNUAL_PERSON_KIND_LABELS[row.personKind],
                    row.designation
                      ? SC_DESIGNATION_LABELS[row.designation] ?? row.designationOther
                      : row.designationOther,
                    row.isResponsiblePerson ? SC_ANNUAL_OFFICER.responsiblePerson.label : null,
                    formatProfileDate(row.appointmentDate)
                      ? `Appointed ${formatProfileDate(row.appointmentDate)}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                })}
                blank={() => ({ personKind: "BOARD" as const, name: "", isResponsiblePerson: false })}
                dialogTitle={(mode) =>
                  mode === "add" ? "Add person" : mode === "view" ? "Person details" : "Edit person"
                }
                onCreate={async (body) => {
                  const res = await api.createOperatorOfficer(shorakaOfficerPayload(body));
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onUpdate={async (id, body) => {
                  const res = await api.updateOperatorOfficer(id, shorakaOfficerPayload(body));
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onDelete={async (id) => {
                  const res = await api.deleteOperatorOfficer(id);
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                fields={(row, set, disabled) => (
                  <>
                    <ShorakaEnumSelect
                      label={SC_ANNUAL_OFFICER.boardOfDirectorManagementTeam.label}
                      value={row.personKind}
                      options={SC_PERSON_KINDS}
                      labels={SC_ANNUAL_PERSON_KIND_LABELS}
                      onChange={(v) => set({ ...row, personKind: v })}
                      disabled={disabled}
                      required
                    />
                    <ShorakaField
                      label={SC_ANNUAL_OFFICER.name.label}
                      value={row.name ?? ""}
                      onChange={(v) => set({ ...row, name: v })}
                      disabled={disabled}
                      required
                      help={SC_ANNUAL_OFFICER.name.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_OFFICER.salutation.label}
                      value={row.salutation ?? ""}
                      onChange={(v) => set({ ...row, salutation: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_OFFICER.salutation.help}
                    />
                    <ShorakaYesNo
                      label={SC_ANNUAL_OFFICER.responsiblePerson.label}
                      value={row.isResponsiblePerson}
                      onChange={(v) => set({ ...row, isResponsiblePerson: v })}
                      disabled={disabled}
                      required
                      help={SC_ANNUAL_OFFICER.responsiblePerson.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_OFFICER.identityNumber.label}
                      value={row.identityNumber ?? ""}
                      onChange={(v) => set({ ...row, identityNumber: v })}
                      disabled={disabled}
                      required
                      help={SC_ANNUAL_OFFICER.identityNumber.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_OFFICER.dateOfBirth.label}
                      type="date"
                      value={toDateInput(row.dateOfBirth)}
                      onChange={(v) => set({ ...row, dateOfBirth: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_OFFICER.dateOfBirth.help}
                    />
                    <ShorakaCountrySelect
                      label={SC_ANNUAL_OFFICER.nationality.label}
                      value={row.nationality ?? ""}
                      onChange={(v) => set({ ...row, nationality: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_OFFICER.nationality.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_OFFICER.address.label}
                      value={row.address ?? ""}
                      onChange={(v) => set({ ...row, address: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_OFFICER.address.help}
                    />
                    <ShorakaEnumSelect
                      label={SC_ANNUAL_OFFICER.designation.label}
                      value={row.designation ?? ""}
                      options={SC_DESIGNATIONS}
                      labels={SC_DESIGNATION_LABELS}
                      onChange={(v) => set({ ...row, designation: v })}
                      disabled={disabled}
                    />
                    {row.designation === "OTHERS" ? (
                      <ShorakaField
                        label={SC_ANNUAL_OFFICER.designationOthers.label}
                        value={row.designationOther ?? ""}
                        onChange={(v) => set({ ...row, designationOther: v })}
                        disabled={disabled}
                        required
                        help={SC_ANNUAL_OFFICER.designationOthers.help}
                      />
                    ) : null}
                    <ShorakaField
                      label={SC_ANNUAL_OFFICER.appointmentDate.label}
                      type="date"
                      value={toDateInput(row.appointmentDate)}
                      onChange={(v) => set({ ...row, appointmentDate: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_OFFICER.appointmentDate.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_OFFICER.resignationDate.label}
                      type="date"
                      value={toDateInput(row.resignationDate)}
                      onChange={(v) => set({ ...row, resignationDate: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_OFFICER.resignationDate.help}
                    />
                  </>
                )}
              />
            </div>
          </AdminDetailTabPanel>

          <AdminDetailTabPanel value="advisors">
            <div id="shoraka-advisors" className="scroll-mt-24">
              <ShorakaRecordSection
                title="Advisers"
                description="Please list all appointed advisors. Each advisor must be entered on a separate line or in separate rows."
                icon={BriefcaseIcon}
                addLabel="Add adviser"
                emptyTitle="No advisers yet"
                emptyMessage="Add Shoraka advisers used for the operator profile and regulatory reporting."
                rows={draft.advisors}
                canManage={canManage}
                renderCard={(row) => ({
                  title: row.name?.trim() || "Unnamed",
                  subtitle: [
                    OPERATOR_ADVISOR_TYPE_LABELS[row.advisorType],
                    row.country,
                    formatProfileDate(row.appointmentDate),
                  ]
                    .filter(Boolean)
                    .join(" · "),
                  meta: (
                    <StatusBadge
                      status={row.cessationDate ? "neutral" : "active"}
                      label={row.cessationDate ? "Ceased" : "Active"}
                    />
                  ),
                })}
                blank={() => ({ advisorType: "ACCOUNTING" as const, name: "" })}
                dialogTitle={(mode) =>
                  mode === "add" ? "Add adviser" : mode === "view" ? "Adviser details" : "Edit adviser"
                }
                onCreate={async (body) => {
                  const res = await api.createOperatorAdvisor(shorakaAdvisorPayload(body));
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onUpdate={async (id, body) => {
                  const res = await api.updateOperatorAdvisor(id, shorakaAdvisorPayload(body));
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onDelete={async (id) => {
                  const res = await api.deleteOperatorAdvisor(id);
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                fields={(row, set, disabled) => (
                  <>
                    <ShorakaEnumSelect
                      label={SC_ANNUAL_ADVISOR.typeOfAdvisor.label}
                      value={row.advisorType}
                      options={OPERATOR_ADVISOR_TYPES}
                      labels={OPERATOR_ADVISOR_TYPE_LABELS}
                      onChange={(v) => set({ ...row, advisorType: v })}
                      disabled={disabled}
                      required
                    />
                    <ShorakaField
                      label={SC_ANNUAL_ADVISOR.name.label}
                      value={row.name ?? ""}
                      onChange={(v) => set({ ...row, name: v })}
                      disabled={disabled}
                      required
                      help={SC_ANNUAL_ADVISOR.name.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_ADVISOR.companyRegistrationNo.label}
                      value={row.registrationNumber ?? ""}
                      onChange={(v) => set({ ...row, registrationNumber: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_ADVISOR.companyRegistrationNo.help}
                    />
                    <ShorakaCountrySelect
                      label={SC_ANNUAL_ADVISOR.country.label}
                      value={row.country ?? ""}
                      onChange={(v) => set({ ...row, country: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_ADVISOR.country.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_ADVISOR.address.label}
                      value={row.address ?? ""}
                      onChange={(v) => set({ ...row, address: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_ADVISOR.address.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_ADVISOR.appointmentDate.label}
                      type="date"
                      value={toDateInput(row.appointmentDate)}
                      onChange={(v) => set({ ...row, appointmentDate: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_ADVISOR.appointmentDate.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_ADVISOR.cessationDate.label}
                      type="date"
                      value={toDateInput(row.cessationDate)}
                      onChange={(v) => set({ ...row, cessationDate: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_ADVISOR.cessationDate.help}
                    />
                  </>
                )}
              />
            </div>
          </AdminDetailTabPanel>

          <AdminDetailTabPanel value="interests">
            <div id="shoraka-interests" className="scroll-mt-24">
              <ShorakaRecordSection
                title="Interest in Other Company"
                description="Shareholdings held by the operator in other companies"
                icon={BuildingOffice2Icon}
                addLabel="Add company"
                emptyTitle="No other company interests yet"
                emptyMessage="Add companies Shoraka has an interest in for the operator profile and regulatory reporting."
                rows={draft.interests}
                canManage={canManage}
                renderCard={(row) => ({
                  title: row.name?.trim() || "Unnamed",
                  subtitle: [
                    row.registrationNumber,
                    row.country,
                    row.shareType ? SC_INTEREST_SHARE_TYPE_LABELS[row.shareType] : null,
                    row.shareholdingUnits,
                    row.shareholdingPercentage ? `${row.shareholdingPercentage}%` : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                })}
                blank={() => ({ name: "" })}
                dialogTitle={(mode) =>
                  mode === "add" ? "Add company" : mode === "view" ? "Company details" : "Edit company"
                }
                onCreate={async (body) => {
                  const res = await api.createOperatorInterest(shorakaInterestPayload(body));
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onUpdate={async (id, body) => {
                  const res = await api.updateOperatorInterest(id, shorakaInterestPayload(body));
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onDelete={async (id) => {
                  const res = await api.deleteOperatorInterest(id);
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                fields={(row, set, disabled) => (
                  <>
                    <ShorakaField
                      label={SC_ANNUAL_INTEREST.name.label}
                      value={row.name ?? ""}
                      onChange={(v) => set({ ...row, name: v })}
                      disabled={disabled}
                      required
                      help={SC_ANNUAL_INTEREST.name.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_INTEREST.roc.label}
                      value={row.registrationNumber ?? ""}
                      onChange={(v) => set({ ...row, registrationNumber: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_INTEREST.roc.help}
                    />
                    <ShorakaCountrySelect
                      label={SC_ANNUAL_INTEREST.country.label}
                      value={row.country ?? ""}
                      onChange={(v) => set({ ...row, country: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_INTEREST.country.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_INTEREST.address.label}
                      value={row.address ?? ""}
                      onChange={(v) => set({ ...row, address: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_INTEREST.address.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_INTEREST.acquisitionDate.label}
                      type="date"
                      value={toDateInput(row.acquisitionDate)}
                      onChange={(v) => set({ ...row, acquisitionDate: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_INTEREST.acquisitionDate.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_INTEREST.disposalDate.label}
                      type="date"
                      value={toDateInput(row.disposalDate)}
                      onChange={(v) => set({ ...row, disposalDate: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_INTEREST.disposalDate.help}
                    />
                    <ShorakaEnumSelect
                      label={SC_ANNUAL_INTEREST.typeOfShares.label}
                      value={row.shareType ?? ""}
                      options={SC_SHARE_TYPES}
                      labels={SC_INTEREST_SHARE_TYPE_LABELS}
                      onChange={(v) => set({ ...row, shareType: v })}
                      disabled={disabled}
                    />
                    {row.shareType === "OTHERS" ? (
                      <ShorakaField
                        label={SC_ANNUAL_INTEREST.typeOfSharesOthers.label}
                        value={row.shareTypeOther ?? ""}
                        onChange={(v) => set({ ...row, shareTypeOther: v })}
                        disabled={disabled}
                        required
                        help={SC_ANNUAL_INTEREST.typeOfSharesOthers.help}
                      />
                    ) : null}
                    <ShorakaField
                      label={SC_ANNUAL_INTEREST.shareholdingUnits.label}
                      value={row.shareholdingUnits ?? ""}
                      onChange={(v) => set({ ...row, shareholdingUnits: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_INTEREST.shareholdingPercentage.label}
                      value={row.shareholdingPercentage ?? ""}
                      onChange={(v) => set({ ...row, shareholdingPercentage: v })}
                      disabled={disabled}
                    />
                  </>
                )}
              />
            </div>
          </AdminDetailTabPanel>

          <AdminDetailTabPanel value="financials">
            <div id="shoraka-financials" className="scroll-mt-24">
              <ShorakaRecordSection
                title="Financial Statements"
                description="Operator financial statements used on the Shoraka master record"
                icon={DocumentTextIcon}
                addLabel="Add financial statement"
                emptyTitle="No financial statements yet"
                emptyMessage="Add at least one Shoraka financial statement to complete the operator profile."
                rows={draft.financialStatements}
                canManage={canManage}
                renderCard={(row) => {
                  const complete = Boolean(row.financialYearEnd && row.auditorName && row.currency);
                  return {
                    title: financialYearLabel(row.financialYearEnd) || "Financial statement",
                    subtitle: [
                      row.auditorName ? `Auditor: ${row.auditorName}` : null,
                      row.currency ? `Currency: ${row.currency}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                    meta: (
                      <StatusBadge
                        status={complete ? "success" : "action"}
                        label={complete ? "Complete" : "Missing"}
                      />
                    ),
                  };
                }}
                blank={() => ({ auditorName: "" })}
                dialogTitle={(mode) =>
                  mode === "add"
                    ? "Add financial statement"
                    : mode === "view"
                      ? "Financial statement"
                      : "Edit financial statement"
                }
                onCreate={async (body) => {
                  const res = await api.createOperatorFinancialStatement(shorakaFinancialPayload(body));
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onUpdate={async (id, body) => {
                  const res = await api.updateOperatorFinancialStatement(id, shorakaFinancialPayload(body));
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onDelete={async (id) => {
                  const res = await api.deleteOperatorFinancialStatement(id);
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                fields={(row, set, disabled) => (
                  <>
                    <ShorakaYesNo
                      label={SC_ANNUAL_FINANCIAL.consolidatedAccounts.label}
                      value={row.consolidatedAccounts}
                      onChange={(v) => set({ ...row, consolidatedAccounts: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_FINANCIAL.consolidatedAccounts.help}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.financialYearEnd.label}
                      type="date"
                      value={toDateInput(row.financialYearEnd)}
                      onChange={(v) => set({ ...row, financialYearEnd: v })}
                      disabled={disabled}
                      required
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.auditorsName.label}
                      value={row.auditorName ?? ""}
                      onChange={(v) => set({ ...row, auditorName: v })}
                      disabled={disabled}
                      help={SC_ANNUAL_FINANCIAL.auditorsName.help}
                    />
                    <ShorakaYesNo
                      label={SC_ANNUAL_FINANCIAL.unmodifiedReports.label}
                      value={row.unmodifiedReports}
                      onChange={(v) => set({ ...row, unmodifiedReports: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.currency.label}
                      value={row.currency ?? ""}
                      onChange={(v) => set({ ...row, currency: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.numberOfShares.label}
                      value={row.numberOfShares ?? ""}
                      onChange={(v) => set({ ...row, numberOfShares: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.dateOfTablingToBoard.label}
                      type="date"
                      value={toDateInput(row.dateTabledToBoard)}
                      onChange={(v) => set({ ...row, dateTabledToBoard: v })}
                      disabled={disabled}
                    />
                    <p className="text-ui font-medium sm:col-span-2">Balance Sheet</p>
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.totalAssets.label}
                      value={row.totalAssets ?? ""}
                      onChange={(v) => set({ ...row, totalAssets: v })}
                      disabled={disabled}
                      required
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.nonCurrentAssets.label}
                      value={row.nonCurrentAssets ?? ""}
                      onChange={(v) => set({ ...row, nonCurrentAssets: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.currentAssets.label}
                      value={row.currentAssets ?? ""}
                      onChange={(v) => set({ ...row, currentAssets: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.totalEquity.label}
                      value={row.totalEquity ?? ""}
                      onChange={(v) => set({ ...row, totalEquity: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.paidUpCapital.label}
                      value={row.paidUpCapital ?? ""}
                      onChange={(v) => set({ ...row, paidUpCapital: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.shareApplicationAccount.label}
                      value={row.shareApplicationAccount ?? ""}
                      onChange={(v) => set({ ...row, shareApplicationAccount: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.sharePremiumAndOtherReserves.label}
                      value={row.sharePremiumAndReserves ?? ""}
                      onChange={(v) => set({ ...row, sharePremiumAndReserves: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.accumulatedProfitCarriedForward.label}
                      value={row.accumulatedProfitCarriedForward ?? ""}
                      onChange={(v) => set({ ...row, accumulatedProfitCarriedForward: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.minorityInterest.label}
                      value={row.equityMinorityInterest ?? ""}
                      onChange={(v) => set({ ...row, equityMinorityInterest: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.totalLiabilities.label}
                      value={row.totalLiabilities ?? ""}
                      onChange={(v) => set({ ...row, totalLiabilities: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.nonCurrentLiabilities.label}
                      value={row.nonCurrentLiabilities ?? ""}
                      onChange={(v) => set({ ...row, nonCurrentLiabilities: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.currentLiabilities.label}
                      value={row.currentLiabilities ?? ""}
                      onChange={(v) => set({ ...row, currentLiabilities: v })}
                      disabled={disabled}
                    />
                    <p className="text-ui font-medium sm:col-span-2">Profit and Loss Account</p>
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.totalRevenue.label}
                      value={row.totalRevenue ?? ""}
                      onChange={(v) => set({ ...row, totalRevenue: v })}
                      disabled={disabled}
                      required
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.donationBased.label}
                      value={row.revenueDonation ?? ""}
                      onChange={(v) => set({ ...row, revenueDonation: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.rewardBased.label}
                      value={row.revenueReward ?? ""}
                      onChange={(v) => set({ ...row, revenueReward: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.lendingBased.label}
                      value={row.revenueLending ?? ""}
                      onChange={(v) => set({ ...row, revenueLending: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.equityBased.label}
                      value={row.revenueEquity ?? ""}
                      onChange={(v) => set({ ...row, revenueEquity: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.feesCharges.label}
                      value={row.revenueFees ?? ""}
                      onChange={(v) => set({ ...row, revenueFees: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.otherRevenue.label}
                      value={row.revenueOther ?? ""}
                      onChange={(v) => set({ ...row, revenueOther: v })}
                      disabled={disabled}
                    />
                    <p className="text-ui font-medium sm:col-span-2">{SC_ANNUAL_FINANCIAL.otherIncome.label}</p>
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.interestFromDepositPlacement.label}
                      value={row.incomeDepositInterest ?? ""}
                      onChange={(v) => set({ ...row, incomeDepositInterest: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.otherIncomeLine.label}
                      value={row.incomeOther ?? ""}
                      onChange={(v) => set({ ...row, incomeOther: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.totalCost.label}
                      value={row.totalCost ?? ""}
                      onChange={(v) => set({ ...row, totalCost: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.staffCost.label}
                      value={row.costStaff ?? ""}
                      onChange={(v) => set({ ...row, costStaff: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.systemCost.label}
                      value={row.costSystem ?? ""}
                      onChange={(v) => set({ ...row, costSystem: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.promotionActivities.label}
                      value={row.costPromotion ?? ""}
                      onChange={(v) => set({ ...row, costPromotion: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.otherCost.label}
                      value={row.costOther ?? ""}
                      onChange={(v) => set({ ...row, costOther: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.profitLossBeforeTax.label}
                      value={row.profitBeforeTax ?? ""}
                      onChange={(v) => set({ ...row, profitBeforeTax: v })}
                      disabled={disabled}
                      required
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.taxation.label}
                      value={row.taxation ?? ""}
                      onChange={(v) => set({ ...row, taxation: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.profitLossAfterTax.label}
                      value={row.profitAfterTax ?? ""}
                      onChange={(v) => set({ ...row, profitAfterTax: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.minorityInterest.label}
                      value={row.pnlMinorityInterest ?? ""}
                      onChange={(v) => set({ ...row, pnlMinorityInterest: v })}
                      disabled={disabled}
                    />
                    <ShorakaField
                      label={SC_ANNUAL_FINANCIAL.netDividend.label}
                      value={row.netDividend ?? ""}
                      onChange={(v) => set({ ...row, netDividend: v })}
                      disabled={disabled}
                    />
                  </>
                )}
              />
            </div>
          </AdminDetailTabPanel>
        </AdminDetailTabs>
      </div>
      </div>
    </RequirePermission>
  );
}

function ShareGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-ui font-medium">{title}</p>
      <ProfileFieldGrid>{children}</ProfileFieldGrid>
    </div>
  );
}
