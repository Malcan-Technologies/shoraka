"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import { MARC_SME_GRADES, marcOfficialRiskProfile, type OrganizationDetailResponse, type PortalType } from "@cashsouk/types";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import { ReadField } from "@/organizations/components/organization-profile-helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function OrganizationMarcCard({
  org,
  organizationId,
  portal,
}: {
  org: OrganizationDetailResponse;
  organizationId: string;
  portal: PortalType;
}) {
  const { can } = usePermissions();
  const canManage = can("organizations.manage");
  const { getAccessToken } = useAuthToken();
  const apiClient = React.useMemo(() => createApiClient(API_URL, getAccessToken), [getAccessToken]);
  const queryClient = useQueryClient();
  const current = org.marcAssessment ?? null;
  const [editing, setEditing] = React.useState(false);
  const [creditGrade, setCreditGrade] = React.useState(current?.creditGrade ?? "");
  const [creditScore, setCreditScore] = React.useState(
    current?.creditScore != null ? String(current.creditScore) : ""
  );
  const [probabilityOfDefault, setProbabilityOfDefault] = React.useState(
    current?.probabilityOfDefault != null ? String(current.probabilityOfDefault) : ""
  );
  const [reportDate, setReportDate] = React.useState(
    current?.reportDate ? current.reportDate.slice(0, 10) : ""
  );

  React.useEffect(() => {
    if (editing) return;
    setCreditGrade(current?.creditGrade ?? "");
    setCreditScore(current?.creditScore != null ? String(current.creditScore) : "");
    setProbabilityOfDefault(
      current?.probabilityOfDefault != null ? String(current.probabilityOfDefault) : ""
    );
    setReportDate(current?.reportDate ? current.reportDate.slice(0, 10) : "");
  }, [current, editing]);

  const save = useMutation({
    mutationFn: async () => {
      const response = await apiClient.createIssuerMarcAssessment(organizationId, {
        creditGrade,
        creditScore: creditScore.trim() ? Number(creditScore) : null,
        probabilityOfDefault: probabilityOfDefault.trim() ? Number(probabilityOfDefault) : null,
        reportDate: reportDate ? new Date(`${reportDate}T00:00:00.000Z`).toISOString() : null,
      });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success("MARC assessment saved");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "organization-detail"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "issuer-marc"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (portal !== "issuer") return null;

  return (
    <Card className="rounded-2xl">
      <AdminDetailCardHeader
        icon={ShieldCheckIcon}
        title="MARC assessment"
        description="Issuer-level MARC grade, score, and PD. New Prospectuses freeze the current values at approval."
        actions={
          canManage ? (
            editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={save.isPending}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void save.mutateAsync()} disabled={save.isPending || !creditGrade}>
                  Save
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                {current ? "Update MARC" : "Add MARC"}
              </Button>
            )
          ) : null
        }
      />
      <CardContent>
        {editing ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-meta text-muted-foreground">MARC credit grade</Label>
              <Select value={creditGrade} onValueChange={setCreditGrade}>
                <SelectTrigger>
                  <SelectValue placeholder="Select SME grade" />
                </SelectTrigger>
                <SelectContent>
                  {MARC_SME_GRADES.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta text-muted-foreground">MARC credit score</Label>
              <Input value={creditScore} onChange={(e) => setCreditScore(e.target.value)} placeholder="0–100" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta text-muted-foreground">Probability of default (%)</Label>
              <Input
                value={probabilityOfDefault}
                onChange={(e) => setProbabilityOfDefault(e.target.value)}
                placeholder="e.g. 7.43"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta text-muted-foreground">Report date</Label>
              <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ReadField label="MARC credit grade" value={current?.creditGrade} />
            <ReadField
              label="MARC risk profile"
              value={marcOfficialRiskProfile(current?.creditGrade)}
            />
            <ReadField
              label="MARC credit score"
              value={current?.creditScore != null ? String(current.creditScore) : null}
            />
            <ReadField
              label="Probability of default"
              value={
                current?.probabilityOfDefault != null ? `${current.probabilityOfDefault}%` : null
              }
            />
            <ReadField
              label="Report date"
              value={current?.reportDate ? format(new Date(current.reportDate), "dd MMM yyyy") : null}
            />
            <ReadField label="Report" value={current?.reportFileName} />
            <ReadField
              label="Last updated"
              value={current?.assessedAt ? format(new Date(current.assessedAt), "dd MMM yyyy") : null}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
