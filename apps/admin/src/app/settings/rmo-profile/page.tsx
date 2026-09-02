"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import {
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
  type OperatorProfileDto,
} from "@cashsouk/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RequirePermission } from "@/components/require-permission";
import { AdminPageHeader } from "@/components/admin-page-header";
import { usePermissions } from "@/hooks/use-permissions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Input className="h-10 text-ui" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </div>
  );
}

function EnumSelect<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  disabled,
}: {
  label: string;
  value: T | "";
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-ui">{label}</Label>
      <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
        <SelectTrigger className="h-10 text-ui">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {labels[opt]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function RmoProfilePage() {
  const { can } = usePermissions();
  const canManage = can("platform_settings.manage");
  const { getAccessToken } = useAuthToken();
  const api = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();

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
  React.useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  if (!draft) {
    return (
      <RequirePermission permission="platform_settings.view">
        <AdminPageHeader title="Shoraka Profile" />
        <p className="text-ui text-muted-foreground">Loading…</p>
      </RequirePermission>
    );
  }

  const cap = draft.shareCapital;

  return (
    <RequirePermission permission="platform_settings.view">
      <div className="space-y-6">
        <AdminPageHeader
          title="Shoraka Profile"
          description="Annual RMO Information Report records for CashSouk. These are operator company fields, not issuer or investor profiles."
        />
        <Tabs defaultValue="general">
          <TabsList className="h-11 flex-wrap">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="capital">Share capital</TabsTrigger>
            <TabsTrigger value="holders">Shareholders / members</TabsTrigger>
            <TabsTrigger value="officers">Board / management</TabsTrigger>
            <TabsTrigger value="advisors">Advisors</TabsTrigger>
            <TabsTrigger value="interests">Other companies</TabsTrigger>
            <TabsTrigger value="financials">Financial statements</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-card-title">[01000] General information</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Name of RMO" value={draft.name ?? ""} onChange={(v) => setDraft({ ...draft, name: v })} disabled={!canManage} />
                <Field label="RMO company registration number" value={draft.registrationNumber ?? ""} onChange={(v) => setDraft({ ...draft, registrationNumber: v })} disabled={!canManage} />
                <Field label="Trustee company registration number" value={draft.trusteeRegistrationNumber ?? ""} onChange={(v) => setDraft({ ...draft, trusteeRegistrationNumber: v })} disabled={!canManage} />
                <Field label="Name of responsible person" value={draft.responsiblePersonName ?? ""} onChange={(v) => setDraft({ ...draft, responsiblePersonName: v })} disabled={!canManage} />
                <Field label="Contact number" value={draft.responsiblePersonPhone ?? ""} onChange={(v) => setDraft({ ...draft, responsiblePersonPhone: v })} disabled={!canManage} />
              </CardContent>
            </Card>
            {canManage ? (
              <Button className="h-10" onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending}>
                Save general information
              </Button>
            ) : null}
          </TabsContent>

          <TabsContent value="capital" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-card-title">[02000] Summary of share capital</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Ordinary — number of shares" value={cap?.ordinaryUnits ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), ordinaryUnits: v } })} disabled={!canManage} />
                <Field label="Ordinary — nominal value (RM)" value={cap?.ordinaryAmount ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), ordinaryAmount: v } })} disabled={!canManage} />
                <Field label="Preference — number of shares" value={cap?.preferenceUnits ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), preferenceUnits: v } })} disabled={!canManage} />
                <Field label="Preference — nominal value (RM)" value={cap?.preferenceAmount ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), preferenceAmount: v } })} disabled={!canManage} />
                <Field label="Others — number of shares" value={cap?.othersUnits ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), othersUnits: v } })} disabled={!canManage} />
                <Field label="Others — nominal value (RM)" value={cap?.othersAmount ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), othersAmount: v } })} disabled={!canManage} />
                <Field label="Total paid-up capital (RM)" value={cap?.totalPaidUpCapital ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), totalPaidUpCapital: v } })} disabled={!canManage} />
                <Field label="LLP members' capital — units" value={cap?.llpMembersCapitalUnits ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), llpMembersCapitalUnits: v } })} disabled={!canManage} />
                <Field label="LLP members' capital — amount" value={cap?.llpMembersCapitalAmount ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), llpMembersCapitalAmount: v } })} disabled={!canManage} />
                <Field label="LLP members' reserves — units" value={cap?.llpMembersReservesUnits ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), llpMembersReservesUnits: v } })} disabled={!canManage} />
                <Field label="LLP members' reserves — amount" value={cap?.llpMembersReservesAmount ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), llpMembersReservesAmount: v } })} disabled={!canManage} />
                <Field label="LLP subordinated loans — units" value={cap?.llpSubordinatedLoansUnits ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), llpSubordinatedLoansUnits: v } })} disabled={!canManage} />
                <Field label="LLP subordinated loans — amount" value={cap?.llpSubordinatedLoansAmount ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), llpSubordinatedLoansAmount: v } })} disabled={!canManage} />
                <Field label="Total LLP (RM)" value={cap?.totalLlp ?? ""} onChange={(v) => setDraft({ ...draft, shareCapital: { ...(cap ?? emptyCapital()), totalLlp: v } })} disabled={!canManage} />
              </CardContent>
            </Card>
            {canManage ? (
              <Button
                className="h-10"
                onClick={() => capitalMutation.mutate({ ...(draft.shareCapital ?? {}) })}
                disabled={capitalMutation.isPending}
              >
                Save share capital
              </Button>
            ) : null}
          </TabsContent>

          <TabsContent value="holders">
            <ChildTable
              title="[03000] Shareholders / members / beneficial owners"
              rows={draft.shareholders}
              canManage={canManage}
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
              blank={() => ({
                holderType: "SHAREHOLDER" as const,
                entityType: "INDIVIDUAL" as const,
                name: "",
                identityNumber: "",
                nationality: "",
                address: "",
              })}
              fields={(row, set) => (
                <>
                  <EnumSelect
                    label="Holder type"
                    value={row.holderType}
                    options={OPERATOR_HOLDER_TYPES}
                    labels={OPERATOR_HOLDER_TYPE_LABELS}
                    onChange={(v: (typeof OPERATOR_HOLDER_TYPES)[number]) =>
                      set({
                        ...row,
                        holderType: v,
                        entityType: v === "BENEFICIAL_OWNER" ? "INDIVIDUAL" : row.entityType,
                      })
                    }
                    disabled={!canManage}
                  />
                  <EnumSelect
                    label="Entity type"
                    value={row.entityType}
                    options={ORGANIZATION_PARTY_ENTITY_TYPES}
                    labels={{ INDIVIDUAL: "Individual", CORPORATE: "Company" }}
                    onChange={(v: (typeof ORGANIZATION_PARTY_ENTITY_TYPES)[number]) => set({ ...row, entityType: v })}
                    disabled={!canManage || row.holderType === "BENEFICIAL_OWNER"}
                  />
                  <Field label="Name" value={row.name ?? ""} onChange={(v) => set({ ...row, name: v })} disabled={!canManage} />
                  <Field label="Salutation" value={row.salutation ?? ""} onChange={(v) => set({ ...row, salutation: v })} disabled={!canManage} />
                  <Field label="IC / passport / ROC" value={row.identityNumber ?? ""} onChange={(v) => set({ ...row, identityNumber: v })} disabled={!canManage} />
                  <Field label="Date of birth" value={toDateInput(row.dateOfBirth)} onChange={(v) => set({ ...row, dateOfBirth: v })} disabled={!canManage} />
                  <Field label="Date of incorporation" value={toDateInput(row.dateOfIncorporation)} onChange={(v) => set({ ...row, dateOfIncorporation: v })} disabled={!canManage} />
                  <Field label="Nationality / country" value={row.nationality ?? ""} onChange={(v) => set({ ...row, nationality: v })} disabled={!canManage} />
                  <Field label="Address" value={row.address ?? ""} onChange={(v) => set({ ...row, address: v })} disabled={!canManage} />
                  <Field label="Date acquired" value={toDateInput(row.dateAcquired)} onChange={(v) => set({ ...row, dateAcquired: v })} disabled={!canManage} />
                  <Field label="Date disposal" value={toDateInput(row.dateDisposal)} onChange={(v) => set({ ...row, dateDisposal: v })} disabled={!canManage} />
                  <EnumSelect label="Type of shares" value={row.shareType ?? ""} options={SC_SHARE_TYPES} labels={SC_SHARE_TYPE_LABELS} onChange={(v) => set({ ...row, shareType: v })} disabled={!canManage} />
                  <Field label="Type of shares — others" value={row.shareTypeOther ?? ""} onChange={(v) => set({ ...row, shareTypeOther: v })} disabled={!canManage} />
                  <Field label="Shareholding units" value={row.shareholdingUnits ?? ""} onChange={(v) => set({ ...row, shareholdingUnits: v })} disabled={!canManage} />
                  <Field label="Shareholding amount (RM)" value={row.shareholdingAmount ?? ""} onChange={(v) => set({ ...row, shareholdingAmount: v })} disabled={!canManage} />
                  <Field label="Shareholding percentage" value={row.shareholdingPercentage ?? ""} onChange={(v) => set({ ...row, shareholdingPercentage: v })} disabled={!canManage} />
                </>
              )}
            />
          </TabsContent>

          <TabsContent value="officers">
            <ChildTable
              title="[04000] Board of director / management team"
              rows={draft.officers}
              canManage={canManage}
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
              blank={() => ({ personKind: "BOARD" as const, name: "", isResponsiblePerson: false })}
              fields={(row, set) => (
                <>
                  <EnumSelect label="Board / management" value={row.personKind} options={SC_PERSON_KINDS} labels={SC_PERSON_KIND_LABELS} onChange={(v: (typeof SC_PERSON_KINDS)[number]) => set({ ...row, personKind: v })} disabled={!canManage} />
                  <Field label="Name" value={row.name ?? ""} onChange={(v) => set({ ...row, name: v })} disabled={!canManage} />
                  <Field label="Salutation" value={row.salutation ?? ""} onChange={(v) => set({ ...row, salutation: v })} disabled={!canManage} />
                  <div className="space-y-2">
                    <Label className="text-ui">Responsible person</Label>
                    <Select
                      value={row.isResponsiblePerson ? "YES" : "NO"}
                      onValueChange={(v) => set({ ...row, isResponsiblePerson: v === "YES" })}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="h-10 text-ui"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YES">Yes</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Field label="Identity number" value={row.identityNumber ?? ""} onChange={(v) => set({ ...row, identityNumber: v })} disabled={!canManage} />
                  <Field label="Date of birth" value={toDateInput(row.dateOfBirth)} onChange={(v) => set({ ...row, dateOfBirth: v })} disabled={!canManage} />
                  <Field label="Nationality" value={row.nationality ?? ""} onChange={(v) => set({ ...row, nationality: v })} disabled={!canManage} />
                  <Field label="Address" value={row.address ?? ""} onChange={(v) => set({ ...row, address: v })} disabled={!canManage} />
                  <EnumSelect label="Designation" value={row.designation ?? ""} options={SC_DESIGNATIONS} labels={SC_DESIGNATION_LABELS} onChange={(v) => set({ ...row, designation: v })} disabled={!canManage} />
                  <Field label="Designation — others" value={row.designationOther ?? ""} onChange={(v) => set({ ...row, designationOther: v })} disabled={!canManage} />
                  <Field label="Appointment date" value={toDateInput(row.appointmentDate)} onChange={(v) => set({ ...row, appointmentDate: v })} disabled={!canManage} />
                  <Field label="Resignation date" value={toDateInput(row.resignationDate)} onChange={(v) => set({ ...row, resignationDate: v })} disabled={!canManage} />
                </>
              )}
            />
          </TabsContent>

          <TabsContent value="advisors">
            <ChildTable
              title="[05000] Advisors"
              rows={draft.advisors}
              canManage={canManage}
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
              blank={() => ({ advisorType: "TRUSTEE_ESCROW" as const, name: "" })}
              fields={(row, set) => (
                <>
                  <EnumSelect label="Type of advisor" value={row.advisorType} options={OPERATOR_ADVISOR_TYPES} labels={OPERATOR_ADVISOR_TYPE_LABELS} onChange={(v: (typeof OPERATOR_ADVISOR_TYPES)[number]) => set({ ...row, advisorType: v })} disabled={!canManage} />
                  <Field label="Name" value={row.name ?? ""} onChange={(v) => set({ ...row, name: v })} disabled={!canManage} />
                  <Field label="Company registration no." value={row.registrationNumber ?? ""} onChange={(v) => set({ ...row, registrationNumber: v })} disabled={!canManage} />
                  <Field label="Country" value={row.country ?? ""} onChange={(v) => set({ ...row, country: v })} disabled={!canManage} />
                  <Field label="Address" value={row.address ?? ""} onChange={(v) => set({ ...row, address: v })} disabled={!canManage} />
                  <Field label="Appointment date" value={toDateInput(row.appointmentDate)} onChange={(v) => set({ ...row, appointmentDate: v })} disabled={!canManage} />
                  <Field label="Cessation date" value={toDateInput(row.cessationDate)} onChange={(v) => set({ ...row, cessationDate: v })} disabled={!canManage} />
                </>
              )}
            />
          </TabsContent>

          <TabsContent value="interests">
            <ChildTable
              title="[10000] Interest in other company"
              rows={draft.interests}
              canManage={canManage}
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
              blank={() => ({ name: "" })}
              fields={(row, set) => (
                <>
                  <Field label="Name" value={row.name ?? ""} onChange={(v) => set({ ...row, name: v })} disabled={!canManage} />
                  <Field label="ROC" value={row.registrationNumber ?? ""} onChange={(v) => set({ ...row, registrationNumber: v })} disabled={!canManage} />
                  <Field label="Country" value={row.country ?? ""} onChange={(v) => set({ ...row, country: v })} disabled={!canManage} />
                  <Field label="Address" value={row.address ?? ""} onChange={(v) => set({ ...row, address: v })} disabled={!canManage} />
                  <Field label="Acquisition date" value={toDateInput(row.acquisitionDate)} onChange={(v) => set({ ...row, acquisitionDate: v })} disabled={!canManage} />
                  <Field label="Disposal date" value={toDateInput(row.disposalDate)} onChange={(v) => set({ ...row, disposalDate: v })} disabled={!canManage} />
                  <EnumSelect label="Type of shares" value={row.shareType ?? ""} options={SC_SHARE_TYPES} labels={SC_SHARE_TYPE_LABELS} onChange={(v) => set({ ...row, shareType: v })} disabled={!canManage} />
                  <Field label="Type of shares — others" value={row.shareTypeOther ?? ""} onChange={(v) => set({ ...row, shareTypeOther: v })} disabled={!canManage} />
                  <Field label="Shareholding units" value={row.shareholdingUnits ?? ""} onChange={(v) => set({ ...row, shareholdingUnits: v })} disabled={!canManage} />
                  <Field label="Shareholding percentage" value={row.shareholdingPercentage ?? ""} onChange={(v) => set({ ...row, shareholdingPercentage: v })} disabled={!canManage} />
                </>
              )}
            />
          </TabsContent>

          <TabsContent value="financials">
            <ChildTable
              title="[11000] Financial statement"
              rows={draft.financialStatements}
              canManage={canManage}
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
              blank={() => ({ currency: "MYR", auditorName: "" })}
              fields={(row, set) => (
                <>
                  <div className="space-y-2">
                    <Label className="text-ui">Consolidated accounts</Label>
                    <Select
                      value={row.consolidatedAccounts == null ? "" : row.consolidatedAccounts ? "YES" : "NO"}
                      onValueChange={(v) => set({ ...row, consolidatedAccounts: v === "YES" })}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="h-10 text-ui"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YES">Yes</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Field label="Financial year end" value={toDateInput(row.financialYearEnd)} onChange={(v) => set({ ...row, financialYearEnd: v })} disabled={!canManage} />
                  <Field label="Auditor's name" value={row.auditorName ?? ""} onChange={(v) => set({ ...row, auditorName: v })} disabled={!canManage} />
                  <div className="space-y-2">
                    <Label className="text-ui">Unmodified reports</Label>
                    <Select
                      value={row.unmodifiedReports == null ? "" : row.unmodifiedReports ? "YES" : "NO"}
                      onValueChange={(v) => set({ ...row, unmodifiedReports: v === "YES" })}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="h-10 text-ui"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YES">Yes</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Field label="Currency" value={row.currency ?? ""} onChange={(v) => set({ ...row, currency: v })} disabled={!canManage} />
                  <Field label="Number of shares" value={row.numberOfShares ?? ""} onChange={(v) => set({ ...row, numberOfShares: v })} disabled={!canManage} />
                  <Field label="Date of tabling to board" value={toDateInput(row.dateTabledToBoard)} onChange={(v) => set({ ...row, dateTabledToBoard: v })} disabled={!canManage} />
                  <Field label="Total assets" value={row.totalAssets ?? ""} onChange={(v) => set({ ...row, totalAssets: v })} disabled={!canManage} />
                  <Field label="Non-current assets" value={row.nonCurrentAssets ?? ""} onChange={(v) => set({ ...row, nonCurrentAssets: v })} disabled={!canManage} />
                  <Field label="Current assets" value={row.currentAssets ?? ""} onChange={(v) => set({ ...row, currentAssets: v })} disabled={!canManage} />
                  <Field label="Total equity" value={row.totalEquity ?? ""} onChange={(v) => set({ ...row, totalEquity: v })} disabled={!canManage} />
                  <Field label="Paid-up capital" value={row.paidUpCapital ?? ""} onChange={(v) => set({ ...row, paidUpCapital: v })} disabled={!canManage} />
                  <Field label="Share application account" value={row.shareApplicationAccount ?? ""} onChange={(v) => set({ ...row, shareApplicationAccount: v })} disabled={!canManage} />
                  <Field label="Share premium & other reserves" value={row.sharePremiumAndReserves ?? ""} onChange={(v) => set({ ...row, sharePremiumAndReserves: v })} disabled={!canManage} />
                  <Field label="Accumulated profit carried forward" value={row.accumulatedProfitCarriedForward ?? ""} onChange={(v) => set({ ...row, accumulatedProfitCarriedForward: v })} disabled={!canManage} />
                  <Field label="Minority interest (equity)" value={row.equityMinorityInterest ?? ""} onChange={(v) => set({ ...row, equityMinorityInterest: v })} disabled={!canManage} />
                  <Field label="Total liabilities" value={row.totalLiabilities ?? ""} onChange={(v) => set({ ...row, totalLiabilities: v })} disabled={!canManage} />
                  <Field label="Non-current liabilities" value={row.nonCurrentLiabilities ?? ""} onChange={(v) => set({ ...row, nonCurrentLiabilities: v })} disabled={!canManage} />
                  <Field label="Current liabilities" value={row.currentLiabilities ?? ""} onChange={(v) => set({ ...row, currentLiabilities: v })} disabled={!canManage} />
                  <Field label="Total revenue" value={row.totalRevenue ?? ""} onChange={(v) => set({ ...row, totalRevenue: v })} disabled={!canManage} />
                  <Field label="Donation based" value={row.revenueDonation ?? ""} onChange={(v) => set({ ...row, revenueDonation: v })} disabled={!canManage} />
                  <Field label="Reward based" value={row.revenueReward ?? ""} onChange={(v) => set({ ...row, revenueReward: v })} disabled={!canManage} />
                  <Field label="Lending based" value={row.revenueLending ?? ""} onChange={(v) => set({ ...row, revenueLending: v })} disabled={!canManage} />
                  <Field label="Equity based" value={row.revenueEquity ?? ""} onChange={(v) => set({ ...row, revenueEquity: v })} disabled={!canManage} />
                  <Field label="Fees charges" value={row.revenueFees ?? ""} onChange={(v) => set({ ...row, revenueFees: v })} disabled={!canManage} />
                  <Field label="Other revenue" value={row.revenueOther ?? ""} onChange={(v) => set({ ...row, revenueOther: v })} disabled={!canManage} />
                  <Field label="Interest from deposit placement" value={row.incomeDepositInterest ?? ""} onChange={(v) => set({ ...row, incomeDepositInterest: v })} disabled={!canManage} />
                  <Field label="Other income" value={row.incomeOther ?? ""} onChange={(v) => set({ ...row, incomeOther: v })} disabled={!canManage} />
                  <Field label="Total cost" value={row.totalCost ?? ""} onChange={(v) => set({ ...row, totalCost: v })} disabled={!canManage} />
                  <Field label="Staff cost" value={row.costStaff ?? ""} onChange={(v) => set({ ...row, costStaff: v })} disabled={!canManage} />
                  <Field label="System cost" value={row.costSystem ?? ""} onChange={(v) => set({ ...row, costSystem: v })} disabled={!canManage} />
                  <Field label="Promotion activities" value={row.costPromotion ?? ""} onChange={(v) => set({ ...row, costPromotion: v })} disabled={!canManage} />
                  <Field label="Other cost" value={row.costOther ?? ""} onChange={(v) => set({ ...row, costOther: v })} disabled={!canManage} />
                  <Field label="Profit/(loss) before tax" value={row.profitBeforeTax ?? ""} onChange={(v) => set({ ...row, profitBeforeTax: v })} disabled={!canManage} />
                  <Field label="Taxation" value={row.taxation ?? ""} onChange={(v) => set({ ...row, taxation: v })} disabled={!canManage} />
                  <Field label="Profit/(loss) after tax" value={row.profitAfterTax ?? ""} onChange={(v) => set({ ...row, profitAfterTax: v })} disabled={!canManage} />
                  <Field label="Minority interest (P&L)" value={row.pnlMinorityInterest ?? ""} onChange={(v) => set({ ...row, pnlMinorityInterest: v })} disabled={!canManage} />
                  <Field label="Net dividend" value={row.netDividend ?? ""} onChange={(v) => set({ ...row, netDividend: v })} disabled={!canManage} />
                </>
              )}
            />
          </TabsContent>
        </Tabs>
      </div>
    </RequirePermission>
  );
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function emptyCapital(): NonNullable<OperatorProfileDto["shareCapital"]> {
  return {
    id: "",
    ordinaryUnits: null,
    ordinaryAmount: null,
    preferenceUnits: null,
    preferenceAmount: null,
    othersUnits: null,
    othersAmount: null,
    totalPaidUpCapital: null,
    llpMembersCapitalUnits: null,
    llpMembersCapitalAmount: null,
    llpMembersReservesUnits: null,
    llpMembersReservesAmount: null,
    llpSubordinatedLoansUnits: null,
    llpSubordinatedLoansAmount: null,
    totalLlp: null,
  };
}

function ChildTable<T extends { id?: string; name?: string | null }>({
  title,
  rows,
  canManage,
  blank,
  fields,
  onCreate,
  onUpdate,
  onDelete,
}: {
  title: string;
  rows: T[];
  canManage: boolean;
  blank: () => Partial<T>;
  fields: (row: T, set: (next: T) => void) => React.ReactNode;
  onCreate: (body: Record<string, unknown>) => Promise<void>;
  onUpdate: (id: string, body: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = React.useState<T | null>(null);
  const [creating, setCreating] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-section-title">{title}</h2>
        {canManage ? (
          <Button className="h-10" variant="outline" onClick={() => { setCreating(true); setEditing({ ...(blank() as T) }); }}>
            Add
          </Button>
        ) : null}
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? <p className="text-ui text-muted-foreground">No records yet.</p> : null}
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <p className="text-ui">{row.name || row.id}</p>
              <div className="flex gap-2">
                {canManage ? (
                  <>
                    <Button className="h-10" variant="outline" onClick={() => { setCreating(false); setEditing(row); }}>
                      Edit
                    </Button>
                    <Button
                      className="h-10"
                      variant="outline"
                      onClick={async () => {
                        if (!row.id) return;
                        try {
                          await onDelete(row.id);
                          toast.success("Removed");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed");
                        }
                      }}
                    >
                      Remove
                    </Button>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-card-title">{creating ? "Add record" : "Edit record"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {fields(editing, setEditing)}
          </CardContent>
          <div className="flex gap-2 p-6 pt-0">
            <Button
              className="h-10"
              onClick={async () => {
                try {
                  const body = { ...editing } as Record<string, unknown>;
                  delete body.id;
                  if (creating || !editing.id) await onCreate(body);
                  else await onUpdate(editing.id, body);
                  setEditing(null);
                  toast.success("Saved");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              Save
            </Button>
            <Button className="h-10" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
