"use client";

import * as React from "react";
import { toast } from "sonner";
import { PencilSquareIcon, PlusIcon } from "@heroicons/react/24/outline";
import type { ApiClient } from "@cashsouk/config";
import {
  OPERATOR_SIGNING_ROLE_LABELS,
  OPERATOR_SIGNING_ROLES,
  SC_ANNUAL_PERSON_KIND_LABELS,
  SC_DESIGNATION_LABELS,
  companyStampDeclaredFileRejection,
  personSignatureDeclaredFileRejection,
  profileValidationErrorFromApi,
  type OperatorProfileDto,
  type OperatorSigningPersonDto,
  type OperatorSigningRole,
} from "@cashsouk/types";
import { Checkbox, ComRepFieldLabel, EmptyState } from "@cashsouk/ui";
import { AdminDetailCardHeader } from "@/components/admin-detail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useS3ViewUrl } from "@/hooks/use-s3";
import { uploadFileToS3 } from "@/lib/upload-file-to-s3";

function personKindLabel(person: Pick<OperatorSigningPersonDto, "personKind" | "designation" | "designationOther">) {
  const designation =
    person.designation === "OTHERS"
      ? person.designationOther
      : person.designation
        ? SC_DESIGNATION_LABELS[person.designation]
        : null;
  return designation || SC_ANNUAL_PERSON_KIND_LABELS[person.personKind];
}

function StampPreview({ s3Key, alt }: { s3Key: string | null; alt: string }) {
  const { data: url } = useS3ViewUrl(s3Key);
  if (!s3Key) {
    return <p className="text-ui text-muted-foreground">No image uploaded.</p>;
  }
  if (!url) {
    return <p className="text-ui text-muted-foreground">Loading preview…</p>;
  }
  return (
    <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-md border bg-background p-2">
      <img src={url} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>
  );
}

export function ShorakaSigningAuthorisationSection({
  profile,
  canManage,
  api,
  onProfileChange,
}: {
  profile: OperatorProfileDto;
  canManage: boolean;
  api: ApiClient;
  onProfileChange: (next: OperatorProfileDto) => void;
}) {
  const stampInputRef = React.useRef<HTMLInputElement | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<OperatorSigningPersonDto | null>(null);
  const [officerId, setOfficerId] = React.useState("");
  const [roles, setRoles] = React.useState<OperatorSigningRole[]>([]);
  const [active, setActive] = React.useState(true);
  const [pendingSignature, setPendingSignature] = React.useState<{
    s3Key: string;
    fileName: string;
    contentType: string;
  } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const signatureInputRef = React.useRef<HTMLInputElement | null>(null);

  const assignedOfficerIds = new Set(profile.signingPeople.map((row) => row.officerId));
  const availableOfficers = profile.officers.filter((officer) => {
    if (editing && officer.id === editing.officerId) return true;
    return !assignedOfficerIds.has(officer.id);
  });

  const openAdd = () => {
    setEditing(null);
    setOfficerId("");
    setRoles([]);
    setActive(true);
    setPendingSignature(null);
    setDialogOpen(true);
  };

  const openEdit = (row: OperatorSigningPersonDto) => {
    setEditing(row);
    setOfficerId(row.officerId);
    setRoles(row.roles);
    setActive(row.active);
    setPendingSignature(null);
    setDialogOpen(true);
  };

  const toggleRole = (role: OperatorSigningRole, checked: boolean) => {
    setRoles((prev) => (checked ? [...prev, role] : prev.filter((item) => item !== role)));
  };

  const applyProfile = (next: OperatorProfileDto) => {
    onProfileChange(next);
  };

  const uploadStamp = async (file: File) => {
    const rejection = companyStampDeclaredFileRejection(file.type, file.size);
    if (rejection) {
      toast.error(rejection);
      return;
    }
    setUploading(true);
    try {
      const upload = await api.requestOperatorCompanyStampUploadUrl({
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });
      if (!upload.success) throw profileValidationErrorFromApi(upload.error);
      await uploadFileToS3(upload.data.uploadUrl, file);
      const saved = await api.patchOperatorCompanyStamp({
        s3Key: upload.data.s3Key,
        fileName: file.name,
        contentType: file.type,
      });
      if (!saved.success) throw profileValidationErrorFromApi(saved.error);
      applyProfile(saved.data);
      toast.success("Company stamp saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save company stamp");
    } finally {
      setUploading(false);
      if (stampInputRef.current) stampInputRef.current.value = "";
    }
  };

  const uploadSignature = async (file: File) => {
    const rejection = personSignatureDeclaredFileRejection(file.type, file.size);
    if (rejection) {
      toast.error(rejection);
      return;
    }
    setUploading(true);
    try {
      const upload = await api.requestOperatorSigningSignatureUploadUrl({
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });
      if (!upload.success) throw profileValidationErrorFromApi(upload.error);
      await uploadFileToS3(upload.data.uploadUrl, file);
      setPendingSignature({
        s3Key: upload.data.s3Key,
        fileName: file.name,
        contentType: file.type,
      });
      toast.success("Signature uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload signature");
    } finally {
      setUploading(false);
      if (signatureInputRef.current) signatureInputRef.current.value = "";
    }
  };

  const savePerson = async () => {
    if (!editing && !officerId) {
      toast.error("Select a Shoraka person");
      return;
    }
    if (roles.length === 0) {
      toast.error("Select at least one signing role");
      return;
    }
    setSaving(true);
    try {
      const signature = pendingSignature ?? undefined;
      const saved = editing
        ? await api.updateOperatorSigningPerson(editing.id, {
            roles,
            active,
            ...(signature ? { signature } : {}),
          })
        : await api.createOperatorSigningPerson({
            officerId,
            roles,
            active,
            ...(signature ? { signature } : {}),
          });
      if (!saved.success) throw profileValidationErrorFromApi(saved.error);
      applyProfile(saved.data);
      setDialogOpen(false);
      toast.success(editing ? "Signing person saved" : "Signing person added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save signing person");
    } finally {
      setSaving(false);
    }
  };

  const dialogTitle = editing ? "Edit signing person" : "Add signing person";
  const selectedOfficer = profile.officers.find((officer) => officer.id === officerId);
  const signatureKey = pendingSignature?.s3Key ?? editing?.signature?.s3Key ?? null;

  return (
    <Card id="shoraka-signing" className="scroll-mt-24 rounded-2xl">
      <AdminDetailCardHeader
        icon={PencilSquareIcon}
        title="Signing & Authorisation"
        description="Shoraka company stamp and people who may later sign or witness documents. This does not change current document output."
      />
      <CardContent className="space-y-8">
        <section className="space-y-3">
          <h3 className="text-card-title">Company Stamp</h3>
          <p className="text-meta text-muted-foreground">
            Upload a PNG, JPG, or WEBP company stamp image (maximum 5 MB). Replacing this keeps the
            previously stored file and updates the Shoraka stamp used by Admin.
          </p>
          <input
            ref={stampInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadStamp(file);
            }}
          />
          <div className="rounded-xl border p-4">
            <StampPreview
              s3Key={profile.companyStamp?.s3Key ?? null}
              alt="Shoraka company stamp preview"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => stampInputRef.current?.click()}
                >
                  {uploading
                    ? "Uploading..."
                    : profile.companyStamp?.s3Key
                      ? "Replace"
                      : "Upload"}
                </Button>
              ) : null}
              {profile.companyStamp?.fileName ? (
                <span className="text-meta text-muted-foreground">{profile.companyStamp.fileName}</span>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h3 className="text-card-title">Signing People</h3>
            {canManage ? (
              <Button type="button" className="h-10 gap-1.5" onClick={openAdd}>
                <PlusIcon className="h-4 w-4" />
                Add signing person
              </Button>
            ) : null}
          </div>

          {profile.signingPeople.length === 0 ? (
            <EmptyState
              title="No signing people yet"
              message="Select an existing Board or Management person, then assign Authorised Signatory or Witness. Director and Board roles are not signing roles."
              action={
                canManage ? (
                  <Button type="button" className="h-10 gap-1.5" onClick={openAdd}>
                    <PlusIcon className="h-4 w-4" />
                    Add signing person
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="space-y-3">
              {profile.signingPeople.map((row) => (
                <div key={row.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                      <p className="text-ui font-medium">{row.personName?.trim() || "Unnamed"}</p>
                      <p className="text-meta text-muted-foreground">{personKindLabel(row)}</p>
                      <div className="space-y-1">
                        <p className="text-meta text-muted-foreground">Signing roles:</p>
                        <p className="text-ui">
                          {row.roles.map((role) => OPERATOR_SIGNING_ROLE_LABELS[role]).join(", ")}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-meta text-muted-foreground">Signature:</p>
                        <StampPreview
                          s3Key={row.signature?.s3Key ?? null}
                          alt={`${row.personName ?? "Person"} signature preview`}
                        />
                      </div>
                      {row.active ? null : (
                        <p className="text-meta text-muted-foreground">Inactive</p>
                      )}
                    </div>
                    {canManage ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <ComRepFieldLabel label="Person" required />
              {editing ? (
                <p className="text-ui">{editing.personName?.trim() || "Unnamed"}</p>
              ) : availableOfficers.length === 0 ? (
                <p className="text-ui text-muted-foreground">
                  Add people under Board & Management first. Each person can be assigned here once.
                </p>
              ) : (
                <Select value={officerId || undefined} onValueChange={setOfficerId}>
                  <SelectTrigger className="h-11 text-ui" aria-label="Person">
                    <SelectValue placeholder="Select existing Shoraka person" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOfficers.map((officer) => (
                      <SelectItem key={officer.id} value={officer.id}>
                        {officer.name?.trim() || "Unnamed"} ·{" "}
                        {SC_ANNUAL_PERSON_KIND_LABELS[officer.personKind]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <ComRepFieldLabel label="Signing role(s)" required />
              <div className="space-y-2">
                {OPERATOR_SIGNING_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-ui">
                    <Checkbox
                      checked={roles.includes(role)}
                      onCheckedChange={(checked) =>
                        toggleRole(role, checked === true)
                      }
                      aria-label={OPERATOR_SIGNING_ROLE_LABELS[role]}
                    />
                    {OPERATOR_SIGNING_ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <ComRepFieldLabel label="Signature" />
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadSignature(file);
                }}
              />
              <StampPreview s3Key={signatureKey} alt="Signature preview" />
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => signatureInputRef.current?.click()}
                >
                  {uploading ? "Uploading..." : signatureKey ? "Replace" : "Upload image"}
                </Button>
              ) : null}
            </div>

            {editing ? (
              <div className="space-y-2">
                <ComRepFieldLabel label="Status" />
                <Select
                  value={active ? "ACTIVE" : "INACTIVE"}
                  onValueChange={(value) => setActive(value === "ACTIVE")}
                >
                  <SelectTrigger className="h-11 text-ui" aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {!editing && selectedOfficer?.personKind === "BOARD" ? (
              <p className="text-meta text-muted-foreground">
                Board or Director is not a signing role. Choose Authorised Signatory or Witness
                explicitly.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || uploading || (!editing && availableOfficers.length === 0)}
              onClick={() => void savePerson()}
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
