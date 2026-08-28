"use client";

import * as React from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";
import {
  MARC_CREDIT_GRADE_FROM_SCORE_HELP,
  MARC_REPORT_REQUIRED_MESSAGE,
  marcOfficialRiskProfile,
  marcSmeGradeFromCreditScore,
  parseMarcCreditScore,
  parseMarcProbabilityOfDefault,
  type OrganizationDetailResponse,
  type PortalType,
} from "@cashsouk/types";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/use-permissions";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import { uploadFileToS3 } from "@/lib/upload-file-to-s3";
import { ReadField } from "@/organizations/components/organization-profile-helpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-meta font-medium text-destructive">{message}</p>;
}

function RequiredMark() {
  return <span className="text-destructive"> *</span>;
}

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
  const { handleViewDocument, viewDocumentPending } = useAdminS3DocumentViewDownload();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const current = org.marcAssessment ?? null;
  const [editing, setEditing] = React.useState(false);
  const [creditScore, setCreditScore] = React.useState(
    current?.creditScore != null ? String(current.creditScore) : ""
  );
  const [probabilityOfDefault, setProbabilityOfDefault] = React.useState(
    current?.probabilityOfDefault != null ? String(current.probabilityOfDefault) : ""
  );
  const [reportDate, setReportDate] = React.useState(
    current?.reportDate ? current.reportDate.slice(0, 10) : ""
  );
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (editing) return;
    setCreditScore(current?.creditScore != null ? String(current.creditScore) : "");
    setProbabilityOfDefault(
      current?.probabilityOfDefault != null ? String(current.probabilityOfDefault) : ""
    );
    setReportDate(current?.reportDate ? current.reportDate.slice(0, 10) : "");
    setPendingFile(null);
    setFieldErrors({});
  }, [current, editing]);

  const derivedGrade = marcSmeGradeFromCreditScore(creditScore);
  const existingReportName = current?.reportFileName?.trim() || "";
  const existingReportKey = current?.reportS3Key?.trim() || "";
  const reportLabel = pendingFile?.name || existingReportName;
  const canViewExisting = Boolean(existingReportKey);

  const save = useMutation({
    mutationFn: async () => {
      const score = parseMarcCreditScore(creditScore);
      const pd = parseMarcProbabilityOfDefault(probabilityOfDefault);
      const errors: Record<string, string> = {};
      if (!score.ok) errors.creditScore = score.message;
      if (!pd.ok) errors.probabilityOfDefault = pd.message;
      if (!reportDate.trim()) errors.reportDate = "Report Date is required.";
      if (!pendingFile && !existingReportName && !existingReportKey) {
        errors.report = MARC_REPORT_REQUIRED_MESSAGE;
      }
      setFieldErrors(errors);
      if (Object.keys(errors).length > 0) {
        throw new Error(Object.values(errors)[0] ?? "MARC assessment is incomplete.");
      }

      let reportS3Key = existingReportKey || null;
      let reportFileName = existingReportName || null;
      if (pendingFile) {
        const upload = await apiClient.requestIssuerMarcReportUploadUrl(organizationId, {
          fileName: pendingFile.name,
          contentType: pendingFile.type || "application/pdf",
          fileSize: pendingFile.size,
        });
        if (!upload.success) throw new Error(upload.error.message);
        await uploadFileToS3(upload.data.uploadUrl, pendingFile);
        reportS3Key = upload.data.s3Key;
        reportFileName = pendingFile.name;
      }

      const response = await apiClient.createIssuerMarcAssessment(organizationId, {
        creditScore: score.ok ? score.value : undefined,
        probabilityOfDefault: pd.ok ? pd.value : undefined,
        reportDate: reportDate ? new Date(`${reportDate}T00:00:00.000Z`).toISOString() : null,
        reportS3Key,
        reportFileName,
      });
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: () => {
      toast.success("MARC assessment saved");
      setEditing(false);
      setPendingFile(null);
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
        title="MARC Credit Assessment"
        description="Issuer-level MARC score, derived grade, PD, and report. New Prospectuses freeze the current values at approval."
        actions={
          canManage ? (
            editing ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={save.isPending}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => void save.mutateAsync()} disabled={save.isPending}>
                  Save MARC Assessment
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-meta text-muted-foreground">
                MARC Report
                <RequiredMark />
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setPendingFile(file);
                  setFieldErrors((prev) => ({ ...prev, report: "" }));
                }}
              />
              {reportLabel ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-ui font-medium">{reportLabel}</p>
                  {canViewExisting && !pendingFile ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={viewDocumentPending}
                      onClick={() => void handleViewDocument(existingReportKey)}
                    >
                      View
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {reportLabel ? "Replace" : "Upload PDF"}
                  </Button>
                </div>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Upload PDF
                </Button>
              )}
              <FieldError message={fieldErrors.report} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta text-muted-foreground">
                Credit Score
                <RequiredMark />
              </Label>
              <Input
                value={creditScore}
                onChange={(e) => {
                  setCreditScore(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, creditScore: "" }));
                }}
                placeholder="0–100"
                inputMode="decimal"
              />
              <FieldError message={fieldErrors.creditScore} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta text-muted-foreground">Credit Grade</Label>
              <div className="break-words py-2 text-ui font-medium">{derivedGrade ?? "—"}</div>
              <p className="text-meta text-muted-foreground">{MARC_CREDIT_GRADE_FROM_SCORE_HELP}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta text-muted-foreground">
                Probability of Default
                <RequiredMark />
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  value={probabilityOfDefault}
                  onChange={(e) => {
                    setProbabilityOfDefault(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, probabilityOfDefault: "" }));
                  }}
                  placeholder="e.g. 1.13"
                  inputMode="decimal"
                />
                <span className="text-ui text-muted-foreground">%</span>
              </div>
              <FieldError message={fieldErrors.probabilityOfDefault} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-meta text-muted-foreground">
                Report Date
                <RequiredMark />
              </Label>
              <Input
                type="date"
                value={reportDate}
                onChange={(e) => {
                  setReportDate(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, reportDate: "" }));
                }}
              />
              <FieldError message={fieldErrors.reportDate} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ReadField label="MARC Report" value={current?.reportFileName} />
              {current?.reportS3Key ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={viewDocumentPending}
                  onClick={() => void handleViewDocument(current.reportS3Key!)}
                >
                  View Report
                </Button>
              ) : null}
            </div>
            <ReadField
              label="Credit Score"
              value={current?.creditScore != null ? String(current.creditScore) : null}
            />
            <ReadField label="Credit Grade" value={current?.creditGrade} />
            <ReadField
              label="MARC risk profile"
              value={marcOfficialRiskProfile(current?.creditGrade)}
            />
            <ReadField
              label="Probability of Default"
              value={
                current?.probabilityOfDefault != null ? `${current.probabilityOfDefault}%` : null
              }
            />
            <ReadField
              label="Report Date"
              value={current?.reportDate ? format(new Date(current.reportDate), "dd MMM yyyy") : null}
            />
            <ReadField
              label="Last Updated"
              value={current?.assessedAt ? format(new Date(current.assessedAt), "dd MMM yyyy") : null}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
