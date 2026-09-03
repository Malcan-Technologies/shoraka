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
  ORGANIZATION_PARTY_ENTITY_TYPES,
  SC_DESIGNATION_LABELS,
  SC_DESIGNATIONS,
  SC_PERSON_KIND_LABELS,
  SC_PERSON_KINDS,
  SC_SHARE_TYPE_LABELS,
  SC_SHARE_TYPES,
  type OperatorHolderType,
  type OperatorProfileDto,
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
  hasLlpCapital,
  ShorakaEnumSelect,
  ShorakaField,
  ShorakaYesNo,
  toDateInput,
} from "./shoraka-profile-fields";
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
        <AdminPageHeader title="Shoraka Profile" />
        <p className="text-ui text-muted-foreground">Loading…</p>
      </RequirePermission>
    );
  }

  const cap = draft.shareCapital;
  const generalMissing = new Set(
    completeness.missing.filter((item) => item.section === "general").map((item) => item.field)
  );
  const capitalMissing = new Set(
    completeness.missing.filter((item) => item.section === "shareCapital").map((item) => item.field)
  );
  const sectionById = new Map(completeness.sections.map((section) => [section.id, section]));
  const completenessRows = COMPLETENESS_ROWS.map((row) => {
    const section = sectionById.get(row.id);
    const missingCount = section?.missing.length ?? 0;
    return {
      id: row.id,
      label: row.label,
      href: `#shoraka-${row.tab}`,
      missingCount,
      complete: missingCount === 0,
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
      <div className="space-y-6">
        <AdminPageHeader
          title="Shoraka Profile"
          description="CashSouk/Shoraka operator master profile used for regulatory reporting."
        />

        <Card className="rounded-2xl">
          <AdminDetailCardHeader
            icon={ClipboardDocumentCheckIcon}
            title="Profile completeness"
            description="Required operator fields for the Shoraka master record"
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
                      label="RMO / Operator Name"
                      value={draft.name ?? ""}
                      onChange={(v) => setDraft({ ...draft, name: v })}
                    />
                    <ShorakaField
                      label="Company Registration Number"
                      value={draft.registrationNumber ?? ""}
                      onChange={(v) => setDraft({ ...draft, registrationNumber: v })}
                    />
                    <ShorakaField
                      label="Trustee Company Registration Number"
                      value={draft.trusteeRegistrationNumber ?? ""}
                      onChange={(v) => setDraft({ ...draft, trusteeRegistrationNumber: v })}
                    />
                    <ShorakaField
                      label="Responsible Person"
                      value={draft.responsiblePersonName ?? ""}
                      onChange={(v) => setDraft({ ...draft, responsiblePersonName: v })}
                    />
                    <ShorakaField
                      label="Responsible Person Contact"
                      value={draft.responsiblePersonPhone ?? ""}
                      onChange={(v) => setDraft({ ...draft, responsiblePersonPhone: v })}
                    />
                  </div>
                ) : (
                  <ProfileFieldGrid>
                    <ProfileReadField
                      label="RMO / Operator Name"
                      value={draft.name}
                      missing={generalMissing.has("name")}
                    />
                    <ProfileReadField
                      label="Company Registration Number"
                      value={draft.registrationNumber}
                      missing={generalMissing.has("registrationNumber")}
                    />
                    <ProfileReadField
                      label="Trustee Company Registration Number"
                      value={draft.trusteeRegistrationNumber}
                    />
                    <ProfileReadField
                      label="Responsible Person"
                      value={draft.responsiblePersonName}
                      missing={generalMissing.has("responsiblePersonName")}
                    />
                    <ProfileReadField
                      label="Responsible Person Contact"
                      value={draft.responsiblePersonPhone}
                      missing={generalMissing.has("responsiblePersonPhone")}
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
                description="Ordinary, preference, other, and LLP capital"
                actions={
                  <AdminCardEditActions
                    canEdit={canManage}
                    isEditing={editingSection === "capital"}
                    canSave
                    isSaving={capitalMutation.isPending}
                    onEdit={() => setEditingSection("capital")}
                    onCancel={() => {
                      if (query.data) setDraft(query.data);
                      setEditingSection(null);
                    }}
                    onSave={() => {
                      capitalMutation.mutate(
                        { ...(draft.shareCapital ?? {}) },
                        { onSuccess: () => setEditingSection(null) }
                      );
                    }}
                  />
                }
              />
              <CardContent className="space-y-6">
                {editingSection === "capital" ? (
                  <>
                    <ShareGroup title="Ordinary Shares">
                      <ShorakaField
                        label="Units"
                        value={cap?.ordinaryUnits ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), ordinaryUnits: v },
                          })
                        }
                      />
                      <ShorakaField
                        label="Amount (RM)"
                        value={cap?.ordinaryAmount ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), ordinaryAmount: v },
                          })
                        }
                      />
                    </ShareGroup>
                    <ShareGroup title="Preference Shares">
                      <ShorakaField
                        label="Units"
                        value={cap?.preferenceUnits ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), preferenceUnits: v },
                          })
                        }
                      />
                      <ShorakaField
                        label="Amount (RM)"
                        value={cap?.preferenceAmount ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), preferenceAmount: v },
                          })
                        }
                      />
                    </ShareGroup>
                    <ShareGroup title="Other Shares">
                      <ShorakaField
                        label="Units"
                        value={cap?.othersUnits ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), othersUnits: v },
                          })
                        }
                      />
                      <ShorakaField
                        label="Amount (RM)"
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
                        label="Total Paid-up Capital (RM)"
                        value={cap?.totalPaidUpCapital ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), totalPaidUpCapital: v },
                          })
                        }
                      />
                    </ProfileFieldGrid>
                    <ShareGroup title="LLP (if applicable)">
                      <ShorakaField
                        label="Members' capital — units"
                        value={cap?.llpMembersCapitalUnits ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), llpMembersCapitalUnits: v },
                          })
                        }
                      />
                      <ShorakaField
                        label="Members' capital — RM"
                        value={cap?.llpMembersCapitalAmount ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), llpMembersCapitalAmount: v },
                          })
                        }
                      />
                      <ShorakaField
                        label="Members' reserves — units"
                        value={cap?.llpMembersReservesUnits ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), llpMembersReservesUnits: v },
                          })
                        }
                      />
                      <ShorakaField
                        label="Members' reserves — RM"
                        value={cap?.llpMembersReservesAmount ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), llpMembersReservesAmount: v },
                          })
                        }
                      />
                      <ShorakaField
                        label="Subordinated loans — units"
                        value={cap?.llpSubordinatedLoansUnits ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), llpSubordinatedLoansUnits: v },
                          })
                        }
                      />
                      <ShorakaField
                        label="Subordinated loans — RM"
                        value={cap?.llpSubordinatedLoansAmount ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), llpSubordinatedLoansAmount: v },
                          })
                        }
                      />
                      <ShorakaField
                        label="Total LLP (RM)"
                        value={cap?.totalLlp ?? ""}
                        onChange={(v) =>
                          setDraft({
                            ...draft,
                            shareCapital: { ...(cap ?? emptyCapital()), totalLlp: v },
                          })
                        }
                      />
                    </ShareGroup>
                  </>
                ) : (
                  <>
                    <ShareGroup title="Ordinary Shares">
                      <ProfileReadField label="Units" value={cap?.ordinaryUnits} />
                      <ProfileReadField label="Amount (RM)" value={cap?.ordinaryAmount} />
                    </ShareGroup>
                    <ShareGroup title="Preference Shares">
                      <ProfileReadField label="Units" value={cap?.preferenceUnits} />
                      <ProfileReadField label="Amount (RM)" value={cap?.preferenceAmount} />
                    </ShareGroup>
                    <ShareGroup title="Other Shares">
                      <ProfileReadField label="Units" value={cap?.othersUnits} />
                      <ProfileReadField label="Amount (RM)" value={cap?.othersAmount} />
                    </ShareGroup>
                    <ProfileFieldGrid>
                      <ProfileReadField
                        label="Total Paid-up Capital"
                        value={cap?.totalPaidUpCapital}
                        missing={capitalMissing.has("totalPaidUpCapital")}
                      />
                    </ProfileFieldGrid>
                    {hasLlpCapital(cap) ? (
                      <ShareGroup title="LLP">
                        <ProfileReadField label="Members' capital — units" value={cap?.llpMembersCapitalUnits} />
                        <ProfileReadField label="Members' capital — RM" value={cap?.llpMembersCapitalAmount} />
                        <ProfileReadField label="Members' reserves — units" value={cap?.llpMembersReservesUnits} />
                        <ProfileReadField label="Members' reserves — RM" value={cap?.llpMembersReservesAmount} />
                        <ProfileReadField
                          label="Subordinated loans — units"
                          value={cap?.llpSubordinatedLoansUnits}
                        />
                        <ProfileReadField
                          label="Subordinated loans — RM"
                          value={cap?.llpSubordinatedLoansAmount}
                        />
                        <ProfileReadField label="Total LLP" value={cap?.totalLlp} />
                      </ShareGroup>
                    ) : null}
                  </>
                )}
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
                  const res = await api.createOperatorShareholder(body);
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onUpdate={async (id, body) => {
                  const res = await api.updateOperatorShareholder(id, body);
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
                    />
                    <ShorakaEnumSelect
                      label="Entity type"
                      value={row.entityType}
                      options={ORGANIZATION_PARTY_ENTITY_TYPES}
                      labels={{ INDIVIDUAL: "Individual", CORPORATE: "Company" }}
                      onChange={(v) => set({ ...row, entityType: v })}
                      disabled={disabled || row.holderType === "BENEFICIAL_OWNER"}
                    />
                    <ShorakaField label="Name" value={row.name ?? ""} onChange={(v) => set({ ...row, name: v })} disabled={disabled} />
                    <ShorakaField label="Salutation" value={row.salutation ?? ""} onChange={(v) => set({ ...row, salutation: v })} disabled={disabled} />
                    <ShorakaField label="IC / passport / ROC" value={row.identityNumber ?? ""} onChange={(v) => set({ ...row, identityNumber: v })} disabled={disabled} />
                    <ShorakaField label="Date of birth" type="date" value={toDateInput(row.dateOfBirth)} onChange={(v) => set({ ...row, dateOfBirth: v })} disabled={disabled} />
                    <ShorakaField label="Date of incorporation" type="date" value={toDateInput(row.dateOfIncorporation)} onChange={(v) => set({ ...row, dateOfIncorporation: v })} disabled={disabled} />
                    <ShorakaField label="Nationality / country" value={row.nationality ?? ""} onChange={(v) => set({ ...row, nationality: v })} disabled={disabled} />
                    <ShorakaField label="Address" value={row.address ?? ""} onChange={(v) => set({ ...row, address: v })} disabled={disabled} />
                    <ShorakaField label="Date acquired" type="date" value={toDateInput(row.dateAcquired)} onChange={(v) => set({ ...row, dateAcquired: v })} disabled={disabled} />
                    <ShorakaField label="Date disposal" type="date" value={toDateInput(row.dateDisposal)} onChange={(v) => set({ ...row, dateDisposal: v })} disabled={disabled} />
                    <ShorakaEnumSelect label="Type of shares" value={row.shareType ?? ""} options={SC_SHARE_TYPES} labels={SC_SHARE_TYPE_LABELS} onChange={(v) => set({ ...row, shareType: v })} disabled={disabled} />
                    <ShorakaField label="Type of shares — others" value={row.shareTypeOther ?? ""} onChange={(v) => set({ ...row, shareTypeOther: v })} disabled={disabled} />
                    <ShorakaField label="Shareholding units" value={row.shareholdingUnits ?? ""} onChange={(v) => set({ ...row, shareholdingUnits: v })} disabled={disabled} />
                    <ShorakaField label="Shareholding amount (RM)" value={row.shareholdingAmount ?? ""} onChange={(v) => set({ ...row, shareholdingAmount: v })} disabled={disabled} />
                    <ShorakaField label="Shareholding percentage" value={row.shareholdingPercentage ?? ""} onChange={(v) => set({ ...row, shareholdingPercentage: v })} disabled={disabled} />
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
                    SC_PERSON_KIND_LABELS[row.personKind],
                    row.designation
                      ? SC_DESIGNATION_LABELS[row.designation] ?? row.designationOther
                      : row.designationOther,
                    row.isResponsiblePerson ? "Responsible person" : null,
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
                  const res = await api.createOperatorOfficer(body);
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onUpdate={async (id, body) => {
                  const res = await api.updateOperatorOfficer(id, body);
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
                    <ShorakaEnumSelect label="Board / management" value={row.personKind} options={SC_PERSON_KINDS} labels={SC_PERSON_KIND_LABELS} onChange={(v) => set({ ...row, personKind: v })} disabled={disabled} />
                    <ShorakaField label="Name" value={row.name ?? ""} onChange={(v) => set({ ...row, name: v })} disabled={disabled} />
                    <ShorakaField label="Salutation" value={row.salutation ?? ""} onChange={(v) => set({ ...row, salutation: v })} disabled={disabled} />
                    <ShorakaYesNo label="Responsible person" value={row.isResponsiblePerson} onChange={(v) => set({ ...row, isResponsiblePerson: v })} disabled={disabled} />
                    <ShorakaField label="Identity number" value={row.identityNumber ?? ""} onChange={(v) => set({ ...row, identityNumber: v })} disabled={disabled} />
                    <ShorakaField label="Date of birth" type="date" value={toDateInput(row.dateOfBirth)} onChange={(v) => set({ ...row, dateOfBirth: v })} disabled={disabled} />
                    <ShorakaField label="Nationality" value={row.nationality ?? ""} onChange={(v) => set({ ...row, nationality: v })} disabled={disabled} />
                    <ShorakaField label="Address" value={row.address ?? ""} onChange={(v) => set({ ...row, address: v })} disabled={disabled} />
                    <ShorakaEnumSelect label="Designation" value={row.designation ?? ""} options={SC_DESIGNATIONS} labels={SC_DESIGNATION_LABELS} onChange={(v) => set({ ...row, designation: v })} disabled={disabled} />
                    <ShorakaField label="Designation — others" value={row.designationOther ?? ""} onChange={(v) => set({ ...row, designationOther: v })} disabled={disabled} />
                    <ShorakaField label="Appointment date" type="date" value={toDateInput(row.appointmentDate)} onChange={(v) => set({ ...row, appointmentDate: v })} disabled={disabled} />
                    <ShorakaField label="Resignation date" type="date" value={toDateInput(row.resignationDate)} onChange={(v) => set({ ...row, resignationDate: v })} disabled={disabled} />
                  </>
                )}
              />
            </div>
          </AdminDetailTabPanel>

          <AdminDetailTabPanel value="advisors">
            <div id="shoraka-advisors" className="scroll-mt-24">
              <ShorakaRecordSection
                title="Advisers"
                description="Trustees, legal, audit, and other advisers on the operator profile"
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
                blank={() => ({ advisorType: "TRUSTEE_ESCROW" as const, name: "" })}
                dialogTitle={(mode) =>
                  mode === "add" ? "Add adviser" : mode === "view" ? "Adviser details" : "Edit adviser"
                }
                onCreate={async (body) => {
                  const res = await api.createOperatorAdvisor(body);
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onUpdate={async (id, body) => {
                  const res = await api.updateOperatorAdvisor(id, body);
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
                    <ShorakaEnumSelect label="Type of advisor" value={row.advisorType} options={OPERATOR_ADVISOR_TYPES} labels={OPERATOR_ADVISOR_TYPE_LABELS} onChange={(v) => set({ ...row, advisorType: v })} disabled={disabled} />
                    <ShorakaField label="Name" value={row.name ?? ""} onChange={(v) => set({ ...row, name: v })} disabled={disabled} />
                    <ShorakaField label="Company registration no." value={row.registrationNumber ?? ""} onChange={(v) => set({ ...row, registrationNumber: v })} disabled={disabled} />
                    <ShorakaField label="Country" value={row.country ?? ""} onChange={(v) => set({ ...row, country: v })} disabled={disabled} />
                    <ShorakaField label="Address" value={row.address ?? ""} onChange={(v) => set({ ...row, address: v })} disabled={disabled} />
                    <ShorakaField label="Appointment date" type="date" value={toDateInput(row.appointmentDate)} onChange={(v) => set({ ...row, appointmentDate: v })} disabled={disabled} />
                    <ShorakaField label="Cessation date" type="date" value={toDateInput(row.cessationDate)} onChange={(v) => set({ ...row, cessationDate: v })} disabled={disabled} />
                  </>
                )}
              />
            </div>
          </AdminDetailTabPanel>

          <AdminDetailTabPanel value="interests">
            <div id="shoraka-interests" className="scroll-mt-24">
              <ShorakaRecordSection
                title="Interests in Other Companies"
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
                    row.shareType ? SC_SHARE_TYPE_LABELS[row.shareType] : null,
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
                  const res = await api.createOperatorInterest(body);
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onUpdate={async (id, body) => {
                  const res = await api.updateOperatorInterest(id, body);
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
                    <ShorakaField label="Company" value={row.name ?? ""} onChange={(v) => set({ ...row, name: v })} disabled={disabled} />
                    <ShorakaField label="ROC" value={row.registrationNumber ?? ""} onChange={(v) => set({ ...row, registrationNumber: v })} disabled={disabled} />
                    <ShorakaField label="Country" value={row.country ?? ""} onChange={(v) => set({ ...row, country: v })} disabled={disabled} />
                    <ShorakaField label="Address" value={row.address ?? ""} onChange={(v) => set({ ...row, address: v })} disabled={disabled} />
                    <ShorakaField label="Acquisition date" type="date" value={toDateInput(row.acquisitionDate)} onChange={(v) => set({ ...row, acquisitionDate: v })} disabled={disabled} />
                    <ShorakaField label="Disposal date" type="date" value={toDateInput(row.disposalDate)} onChange={(v) => set({ ...row, disposalDate: v })} disabled={disabled} />
                    <ShorakaEnumSelect label="Type of shares" value={row.shareType ?? ""} options={SC_SHARE_TYPES} labels={SC_SHARE_TYPE_LABELS} onChange={(v) => set({ ...row, shareType: v })} disabled={disabled} />
                    <ShorakaField label="Type of shares — others" value={row.shareTypeOther ?? ""} onChange={(v) => set({ ...row, shareTypeOther: v })} disabled={disabled} />
                    <ShorakaField label="Shareholding units" value={row.shareholdingUnits ?? ""} onChange={(v) => set({ ...row, shareholdingUnits: v })} disabled={disabled} />
                    <ShorakaField label="Shareholding percentage" value={row.shareholdingPercentage ?? ""} onChange={(v) => set({ ...row, shareholdingPercentage: v })} disabled={disabled} />
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
                blank={() => ({ currency: "MYR", auditorName: "" })}
                dialogTitle={(mode) =>
                  mode === "add"
                    ? "Add financial statement"
                    : mode === "view"
                      ? "Financial statement"
                      : "Edit financial statement"
                }
                onCreate={async (body) => {
                  const res = await api.createOperatorFinancialStatement(body);
                  if (!res.success) throw new Error(res.error.message);
                  queryClient.setQueryData(["admin", "operator-profile"], res.data);
                }}
                onUpdate={async (id, body) => {
                  const res = await api.updateOperatorFinancialStatement(id, body);
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
                    <ShorakaYesNo label="Consolidated accounts" value={row.consolidatedAccounts} onChange={(v) => set({ ...row, consolidatedAccounts: v })} disabled={disabled} />
                    <ShorakaField label="Financial year end" type="date" value={toDateInput(row.financialYearEnd)} onChange={(v) => set({ ...row, financialYearEnd: v })} disabled={disabled} />
                    <ShorakaField label="Auditor's name" value={row.auditorName ?? ""} onChange={(v) => set({ ...row, auditorName: v })} disabled={disabled} />
                    <ShorakaYesNo label="Unmodified reports" value={row.unmodifiedReports} onChange={(v) => set({ ...row, unmodifiedReports: v })} disabled={disabled} />
                    <ShorakaField label="Currency" value={row.currency ?? ""} onChange={(v) => set({ ...row, currency: v })} disabled={disabled} />
                    <ShorakaField label="Number of shares" value={row.numberOfShares ?? ""} onChange={(v) => set({ ...row, numberOfShares: v })} disabled={disabled} />
                    <ShorakaField label="Date of tabling to board" type="date" value={toDateInput(row.dateTabledToBoard)} onChange={(v) => set({ ...row, dateTabledToBoard: v })} disabled={disabled} />
                    <ShorakaField label="Total assets" value={row.totalAssets ?? ""} onChange={(v) => set({ ...row, totalAssets: v })} disabled={disabled} />
                    <ShorakaField label="Non-current assets" value={row.nonCurrentAssets ?? ""} onChange={(v) => set({ ...row, nonCurrentAssets: v })} disabled={disabled} />
                    <ShorakaField label="Current assets" value={row.currentAssets ?? ""} onChange={(v) => set({ ...row, currentAssets: v })} disabled={disabled} />
                    <ShorakaField label="Total equity" value={row.totalEquity ?? ""} onChange={(v) => set({ ...row, totalEquity: v })} disabled={disabled} />
                    <ShorakaField label="Paid-up capital" value={row.paidUpCapital ?? ""} onChange={(v) => set({ ...row, paidUpCapital: v })} disabled={disabled} />
                    <ShorakaField label="Share application account" value={row.shareApplicationAccount ?? ""} onChange={(v) => set({ ...row, shareApplicationAccount: v })} disabled={disabled} />
                    <ShorakaField label="Share premium & other reserves" value={row.sharePremiumAndReserves ?? ""} onChange={(v) => set({ ...row, sharePremiumAndReserves: v })} disabled={disabled} />
                    <ShorakaField label="Accumulated profit carried forward" value={row.accumulatedProfitCarriedForward ?? ""} onChange={(v) => set({ ...row, accumulatedProfitCarriedForward: v })} disabled={disabled} />
                    <ShorakaField label="Minority interest (equity)" value={row.equityMinorityInterest ?? ""} onChange={(v) => set({ ...row, equityMinorityInterest: v })} disabled={disabled} />
                    <ShorakaField label="Total liabilities" value={row.totalLiabilities ?? ""} onChange={(v) => set({ ...row, totalLiabilities: v })} disabled={disabled} />
                    <ShorakaField label="Non-current liabilities" value={row.nonCurrentLiabilities ?? ""} onChange={(v) => set({ ...row, nonCurrentLiabilities: v })} disabled={disabled} />
                    <ShorakaField label="Current liabilities" value={row.currentLiabilities ?? ""} onChange={(v) => set({ ...row, currentLiabilities: v })} disabled={disabled} />
                    <ShorakaField label="Total revenue" value={row.totalRevenue ?? ""} onChange={(v) => set({ ...row, totalRevenue: v })} disabled={disabled} />
                    <ShorakaField label="Donation based" value={row.revenueDonation ?? ""} onChange={(v) => set({ ...row, revenueDonation: v })} disabled={disabled} />
                    <ShorakaField label="Reward based" value={row.revenueReward ?? ""} onChange={(v) => set({ ...row, revenueReward: v })} disabled={disabled} />
                    <ShorakaField label="Lending based" value={row.revenueLending ?? ""} onChange={(v) => set({ ...row, revenueLending: v })} disabled={disabled} />
                    <ShorakaField label="Equity based" value={row.revenueEquity ?? ""} onChange={(v) => set({ ...row, revenueEquity: v })} disabled={disabled} />
                    <ShorakaField label="Fees charges" value={row.revenueFees ?? ""} onChange={(v) => set({ ...row, revenueFees: v })} disabled={disabled} />
                    <ShorakaField label="Other revenue" value={row.revenueOther ?? ""} onChange={(v) => set({ ...row, revenueOther: v })} disabled={disabled} />
                    <ShorakaField label="Interest from deposit placement" value={row.incomeDepositInterest ?? ""} onChange={(v) => set({ ...row, incomeDepositInterest: v })} disabled={disabled} />
                    <ShorakaField label="Other income" value={row.incomeOther ?? ""} onChange={(v) => set({ ...row, incomeOther: v })} disabled={disabled} />
                    <ShorakaField label="Total cost" value={row.totalCost ?? ""} onChange={(v) => set({ ...row, totalCost: v })} disabled={disabled} />
                    <ShorakaField label="Staff cost" value={row.costStaff ?? ""} onChange={(v) => set({ ...row, costStaff: v })} disabled={disabled} />
                    <ShorakaField label="System cost" value={row.costSystem ?? ""} onChange={(v) => set({ ...row, costSystem: v })} disabled={disabled} />
                    <ShorakaField label="Promotion activities" value={row.costPromotion ?? ""} onChange={(v) => set({ ...row, costPromotion: v })} disabled={disabled} />
                    <ShorakaField label="Other cost" value={row.costOther ?? ""} onChange={(v) => set({ ...row, costOther: v })} disabled={disabled} />
                    <ShorakaField label="Profit/(loss) before tax" value={row.profitBeforeTax ?? ""} onChange={(v) => set({ ...row, profitBeforeTax: v })} disabled={disabled} />
                    <ShorakaField label="Taxation" value={row.taxation ?? ""} onChange={(v) => set({ ...row, taxation: v })} disabled={disabled} />
                    <ShorakaField label="Profit/(loss) after tax" value={row.profitAfterTax ?? ""} onChange={(v) => set({ ...row, profitAfterTax: v })} disabled={disabled} />
                    <ShorakaField label="Minority interest (P&L)" value={row.pnlMinorityInterest ?? ""} onChange={(v) => set({ ...row, pnlMinorityInterest: v })} disabled={disabled} />
                    <ShorakaField label="Net dividend" value={row.netDividend ?? ""} onChange={(v) => set({ ...row, netDividend: v })} disabled={disabled} />
                  </>
                )}
              />
            </div>
          </AdminDetailTabPanel>
        </AdminDetailTabs>
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
