"use client";

import * as React from "react";
import { toast } from "sonner";
import { PencilSquareIcon, PlusIcon } from "@heroicons/react/24/outline";
import type { ApiClient } from "@cashsouk/config";
import {
  OPERATOR_DOCUMENT_EXECUTION_ROLE_LABELS,
  OPERATOR_DOCUMENT_KIND_LABELS,
  OPERATOR_DOCUMENT_KIND_PLACEMENTS,
  OPERATOR_DOCUMENT_KINDS,
  OPERATOR_SIGNING_ROLE_LABELS,
  OPERATOR_SIGNING_ROLES,
  SC_ANNUAL_PERSON_KIND_LABELS,
  SC_DESIGNATION_LABELS,
  allDocumentExecutionSlots,
  companyStampDeclaredFileRejection,
  documentExecutionBindingIssues,
  documentExecutionSlotLabel,
  documentKindForExecutionRole,
  executionRoleSigningRole,
  isOperatorDocumentRepresentativeRole,
  operatorOfficerDesignationLabel,
  profileValidationErrorFromApi,
  signingCloudLegalImageDeclaredFileRejection,
  type OperatorDocumentExecutionRole,
  type OperatorDocumentExecutionSlotDto,
  COMPANY_STAMP_FILE_ACCEPT,
  type OperatorProfileDto,
  type OperatorSigningPersonDto,
  type OperatorSigningRole,
} from "@cashsouk/types";
import { Checkbox, ComRepFieldLabel, EmptyState, StatusBadge } from "@cashsouk/ui";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useS3ViewUrl } from "@/hooks/use-s3";
import { cn } from "@/lib/utils";
import { uploadFileToS3 } from "@/lib/upload-file-to-s3";

const UNASSIGNED_PERSON = "unassigned";

function personKindLabel(person: Pick<OperatorSigningPersonDto, "personKind" | "designation" | "designationOther">) {
  const designation =
    person.designation === "OTHERS"
      ? person.designationOther
      : person.designation
        ? SC_DESIGNATION_LABELS[person.designation]
        : null;
  return designation || SC_ANNUAL_PERSON_KIND_LABELS[person.personKind];
}

function canBindToDocumentExecution(person: OperatorSigningPersonDto): boolean {
  return person.active && person.roles.includes("AUTHORISED_SIGNATORY");
}

function canBindToWitness(person: OperatorSigningPersonDto): boolean {
  return person.active && person.roles.includes("WITNESS");
}

function personReadyForSlot(
  person: OperatorSigningPersonDto,
  roleKey: OperatorDocumentExecutionRole
): boolean {
  return executionRoleSigningRole(roleKey) === "WITNESS"
    ? person.witnessProviderReady
    : person.signatureProviderReady;
}

function executionRoleShortLabel(roleKey: OperatorDocumentExecutionRole): string {
  const full = OPERATOR_DOCUMENT_EXECUTION_ROLE_LABELS[roleKey];
  const prefix = `${OPERATOR_DOCUMENT_KIND_LABELS[documentKindForExecutionRole(roleKey)]} — `;
  if (!full.startsWith(prefix)) return full;
  const rest = full.slice(prefix.length);
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function executionSlotLocalLabel(roleKey: OperatorDocumentExecutionRole, slotIndex: number): string {
  const role = executionRoleShortLabel(roleKey);
  if (isOperatorDocumentRepresentativeRole(roleKey)) {
    return `${role} representative ${slotIndex}`;
  }
  return role.replace(/ witness$/i, " Witness");
}

function StampPreview({
  s3Key,
  alt,
  className,
}: {
  s3Key: string | null;
  alt: string;
  className?: string;
}) {
  const { data: url, isError, isFetching } = useS3ViewUrl(s3Key);
  const [broken, setBroken] = React.useState(false);

  React.useEffect(() => {
    setBroken(false);
  }, [s3Key, url]);

  if (!s3Key) {
    return <p className="text-ui text-muted-foreground">No image uploaded.</p>;
  }
  if (isError || broken) {
    return <p className="text-ui text-muted-foreground">Preview unavailable.</p>;
  }
  if (!url || isFetching) {
    return <p className="text-ui text-muted-foreground">Loading preview…</p>;
  }
  return (
    <div
      className={cn(
        "flex h-16 w-28 items-center justify-center overflow-hidden rounded-md border bg-background p-2",
        className
      )}
    >
      <img
        src={url}
        alt={alt}
        className="max-h-full max-w-full object-contain"
        onError={() => setBroken(true)}
      />
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
  const [signingEmail, setSigningEmail] = React.useState("");
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
    setSigningEmail("");
    setActive(true);
    setPendingSignature(null);
    setDialogOpen(true);
  };

  const openEdit = (row: OperatorSigningPersonDto) => {
    setEditing(row);
    setOfficerId(row.officerId);
    setRoles(row.roles);
    setSigningEmail(row.signingEmail ?? "");
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
    const rejection = signingCloudLegalImageDeclaredFileRejection(file.type, file.size);
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
      const signingEmailValue = signingEmail.trim() === "" ? null : signingEmail.trim();
      const saved = editing
        ? await api.updateOperatorSigningPerson(editing.id, {
            roles,
            active,
            signingEmail: signingEmailValue,
            ...(signature ? { signature } : {}),
          })
        : await api.createOperatorSigningPerson({
            officerId,
            roles,
            active,
            signingEmail: signingEmailValue,
            ...(signature ? { signature } : {}),
          });
      if (!saved.success) throw profileValidationErrorFromApi(saved.error);
      let next = saved.data;
      if (signature) {
        const personId = editing
          ? editing.id
          : next.signingPeople.find((row) => row.officerId === officerId)?.id;
        if (!personId) throw new Error("Signing person was saved without an id");
        const confirmed = await api.confirmOperatorSigningPersonSignature(personId, {
          s3Key: signature.s3Key,
        });
        if (!confirmed.success) {
          applyProfile(next);
          throw profileValidationErrorFromApi(confirmed.error);
        }
        next = confirmed.data;
      }
      applyProfile(next);
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
      <CardContent>
        <div className="space-y-8" data-signing-layout="stack">
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
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-ui font-medium">
                          {row.personName?.trim() || "Unnamed"}
                        </p>
                        <p className="text-meta text-muted-foreground">{personKindLabel(row)}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {row.roles.map((role) => (
                            <StatusBadge
                              key={role}
                              status="neutral"
                              label={OPERATOR_SIGNING_ROLE_LABELS[role]}
                              showDot={false}
                              size="sm"
                            />
                          ))}
                          {row.active ? null : (
                            <StatusBadge status="neutral" label="Inactive" size="sm" />
                          )}
                          <StatusBadge
                            status={row.signatureProviderReady ? "success" : "action"}
                            label={
                              row.signatureProviderReady
                                ? "Ready for automatic signing"
                                : "Needs email and confirmed signature"
                            }
                            size="sm"
                          />
                        </div>
                        <p className="text-ui">
                          {row.signingEmail?.trim() || "SigningCloud email not set"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {canManage ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(row)}
                          >
                            Edit
                          </Button>
                        ) : null}
                        <StampPreview
                          s3Key={row.signature?.s3Key ?? null}
                          alt={`${row.personName ?? "Person"} signature preview`}
                          className="h-14 w-24"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-card-title">Company Stamp</h3>
            <p className="text-meta text-muted-foreground">
              Upload a PNG or JPG company stamp image (maximum 5 MB). Replacing this keeps the
              previously stored file and updates the Shoraka stamp used by Admin.
            </p>
            <input
              ref={stampInputRef}
              type="file"
              accept={COMPANY_STAMP_FILE_ACCEPT}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadStamp(file);
              }}
            />
            <div className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
              <StampPreview
                s3Key={profile.companyStamp?.s3Key ?? null}
                alt="Shoraka company stamp preview"
                className="h-20 w-32"
              />
              <div className="min-w-0 space-y-2">
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
                <p className="text-meta text-muted-foreground">
                  {profile.companyStamp?.fileName ?? "No file uploaded"}
                </p>
              </div>
            </div>
          </section>

          <DocumentExecutionAssignments
            profile={profile}
            canManage={canManage}
            api={api}
            onProfileChange={applyProfile}
          />
        </div>
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
              <ComRepFieldLabel
                htmlFor="signing-cloud-email"
                label="SigningCloud email"
                help="SigningCloud identity for this person. Required for automatic signing."
              />
              <Input
                id="signing-cloud-email"
                className="h-11 text-ui"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={signingEmail}
                onChange={(event) => setSigningEmail(event.target.value)}
                aria-label="SigningCloud email"
              />
            </div>

            <div className="space-y-2">
              <ComRepFieldLabel
                label="Signature"
                help="PNG or JPG, 500 KB or smaller, and 300 × 300 pixels or smaller."
              />
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg"
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
              {pendingSignature ? (
                <p className="text-meta text-muted-foreground">
                  Signature will be confirmed after save.
                </p>
              ) : editing ? (
                <p className="text-meta text-muted-foreground">
                  {editing.signatureProviderReady
                    ? "Ready for automatic signing"
                    : "Needs email and confirmed signature"}
                </p>
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

function DocumentExecutionAssignments({
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
  const [slots, setSlots] = React.useState<OperatorDocumentExecutionSlotDto[]>(
    profile.documentExecutionSlots
  );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setSlots(profile.documentExecutionSlots);
  }, [profile.documentExecutionSlots]);

  const peopleById = new Map(profile.signingPeople.map((person) => [person.id, person]));

  const updateSlot = (
    roleKey: OperatorDocumentExecutionRole,
    slotIndex: number,
    patch: Partial<OperatorDocumentExecutionSlotDto>
  ) => {
    setSlots((prev) =>
      prev.map((row) =>
        row.roleKey === roleKey && row.slotIndex === slotIndex ? { ...row, ...patch } : row
      )
    );
  };

  const issues = documentExecutionBindingIssues({
    requiredSlots: allDocumentExecutionSlots(),
    companyStampReady: Boolean(profile.companyStamp?.s3Key),
    bindings: slots.map((slot) => {
      const person = slot.signingPersonId ? peopleById.get(slot.signingPersonId) : undefined;
      return {
        roleKey: slot.roleKey,
        slotIndex: slot.slotIndex,
        signingPersonId: slot.signingPersonId,
        signingEmail: person?.signingEmail ?? null,
        officerName: person?.personName ?? null,
        designation: person
          ? operatorOfficerDesignationLabel({
              designation: person.designation,
              designationOther: person.designationOther,
            })
          : null,
        identityNumber: person?.identityNumber ?? null,
        providerReady: person ? personReadyForSlot(person, slot.roleKey) : false,
      };
    }),
  });

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.putOperatorDocumentExecutionBindings({
        bindings: allDocumentExecutionSlots().map((ref) => {
          const row = slots.find(
            (item) => item.roleKey === ref.roleKey && item.slotIndex === ref.slotIndex
          );
          return {
            roleKey: ref.roleKey,
            slotIndex: ref.slotIndex,
            signingPersonId: row?.signingPersonId ?? null,
          };
        }),
      });
      if (!saved.success) throw profileValidationErrorFromApi(saved.error);
      onProfileChange(saved.data);
      toast.success("Document execution assignments saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save document execution assignments"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3">
      <h3 className="text-card-title">Document execution assignments</h3>
      <p className="text-meta text-muted-foreground">
        Assign two authorised representatives for each CashSouk execution role, then one reusable
        witness per section. The same person may appear across roles; a two-person pair must still
        be two different people.
      </p>
      {issues.length > 0 ? (
        <ul className="space-y-1 rounded-xl border border-border bg-muted/30 px-4 py-3">
          {issues.map((issue) => (
            <li
              key={`${issue.code}:${issue.roleKey}:${issue.slotIndex}`}
              className="text-meta text-muted-foreground"
            >
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="space-y-3">
        {OPERATOR_DOCUMENT_KINDS.map((kind) => (
          <div key={kind} className="space-y-4 rounded-xl border p-4">
            <p className="text-ui font-medium">{OPERATOR_DOCUMENT_KIND_LABELS[kind]}</p>
            {OPERATOR_DOCUMENT_KIND_PLACEMENTS[kind].map((roleKey) => (
              <ExecutionRoleGroup
                key={roleKey}
                roleKey={roleKey}
                slots={slots}
                profile={profile}
                canManage={canManage}
                onUpdate={updateSlot}
              />
            ))}
          </div>
        ))}
      </div>
      {canManage ? (
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving..." : "Save assignments"}
        </Button>
      ) : null}
    </section>
  );
}

function ExecutionRoleGroup({
  roleKey,
  slots,
  profile,
  canManage,
  onUpdate,
}: {
  roleKey: OperatorDocumentExecutionRole;
  slots: OperatorDocumentExecutionSlotDto[];
  profile: OperatorProfileDto;
  canManage: boolean;
  onUpdate: (
    roleKey: OperatorDocumentExecutionRole,
    slotIndex: number,
    patch: Partial<OperatorDocumentExecutionSlotDto>
  ) => void;
}) {
  const group = slots
    .filter((row) => row.roleKey === roleKey)
    .sort((left, right) => left.slotIndex - right.slotIndex);
  const paired = isOperatorDocumentRepresentativeRole(roleKey);
  return (
    <div className={paired ? "grid gap-3 sm:grid-cols-2" : undefined}>
      {group.map((slot) => (
        <ExecutionSlotFields
          key={`${slot.roleKey}:${slot.slotIndex}`}
          slot={slot}
          profile={profile}
          canManage={canManage}
          siblingPersonId={
            paired
              ? group.find((row) => row.slotIndex !== slot.slotIndex)?.signingPersonId ?? null
              : null
          }
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

function ExecutionSlotFields({
  slot,
  profile,
  canManage,
  siblingPersonId,
  onUpdate,
}: {
  slot: OperatorDocumentExecutionSlotDto;
  profile: OperatorProfileDto;
  canManage: boolean;
  siblingPersonId: string | null;
  onUpdate: (
    roleKey: OperatorDocumentExecutionRole,
    slotIndex: number,
    patch: Partial<OperatorDocumentExecutionSlotDto>
  ) => void;
}) {
  const personId = slot.signingPersonId ?? null;
  const personLabel =
    profile.signingPeople.find((person) => person.id === personId)?.personName?.trim() ||
    "Unassigned";
  const requiredRole = executionRoleSigningRole(slot.roleKey);
  const canBind = requiredRole === "WITNESS" ? canBindToWitness : canBindToDocumentExecution;
  const localLabel = executionSlotLocalLabel(slot.roleKey, slot.slotIndex);
  return (
    <div className="space-y-2">
      {canManage ? (
        <>
          <ComRepFieldLabel label={localLabel} />
          <Select
            value={personId ?? UNASSIGNED_PERSON}
            onValueChange={(value) =>
              onUpdate(slot.roleKey, slot.slotIndex, {
                signingPersonId: value === UNASSIGNED_PERSON ? null : value,
              })
            }
          >
            <SelectTrigger
              className="h-11 text-ui"
              aria-label={`${documentExecutionSlotLabel(slot.roleKey, slot.slotIndex)} person`}
            >
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED_PERSON}>Unassigned</SelectItem>
              {profile.signingPeople.map((person) => (
                <SelectItem
                  key={person.id}
                  value={person.id}
                  disabled={
                    !canBind(person) || (siblingPersonId === person.id && person.id !== personId)
                  }
                >
                  {person.personName?.trim() || "Unnamed"}
                  {!person.active
                    ? " (inactive)"
                    : canBind(person)
                      ? ""
                      : requiredRole === "WITNESS"
                        ? " (not a Witness)"
                        : " (witness only)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      ) : (
        <div className="space-y-1">
          <p className="text-meta text-muted-foreground">{localLabel}</p>
          <p className="text-ui">{personLabel}</p>
        </div>
      )}
    </div>
  );
}
