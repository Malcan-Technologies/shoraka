"use client";

import * as React from "react";
import {
  SIGNING_ROLE_REGISTRY,
  createDefaultRoleFromRegistry,
  parseSigningTemplateConfig,
  sanitizeSigningTemplateConfig,
  type SigningDocumentSource,
  type SigningRoleKey,
  type SigningTemplateConfig,
  type SigningTemplateDocument,
  type SigningTemplateRole,
  type SigningTemplateSupportingDocRef,
} from "@cashsouk/types";
import { cn } from "@/lib/utils";
import { Input } from "../../../../../components/ui/input";
import { Button } from "../../../../../components/ui/button";
import { Switch } from "../../../../../components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../components/ui/select";
import { INPUT_CLASS, SELECT_TRIGGER_CLASS, SECTION_GAP } from "../product-form-input-styles";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

const SYSTEM_SIGNING_TEMPLATES = [
  {
    templateKey: "offer_letter",
    label: "Offer letter",
    description: "Generated from the system offer letter template",
    source: "GENERATED_OFFER_LETTER" as SigningDocumentSource,
    defaultName: "Offer letter",
  },
] as const;

type SystemTemplateKey = (typeof SYSTEM_SIGNING_TEMPLATES)[number]["templateKey"];

export type PostApplicationDocOption = {
  step_key: string;
  label: string;
};

function defaultRole(roleIndex: number, roleKey: SigningRoleKey = "issuer_director"): SigningTemplateRole {
  return createDefaultRoleFromRegistry(roleKey, roleIndex);
}

function createDocumentFromSystemTemplate(
  templateKey: SystemTemplateKey,
  order: number,
  initialRole: SigningTemplateRole
): SigningTemplateDocument {
  const systemTemplate = SYSTEM_SIGNING_TEMPLATES.find((item) => item.templateKey === templateKey);
  if (!systemTemplate) {
    throw new Error(`Unknown system template: ${templateKey}`);
  }
  return {
    key: systemTemplate.templateKey,
    name: systemTemplate.defaultName,
    source: systemTemplate.source,
    required: true,
    order,
    signer_role_keys: [initialRole.key],
  };
}

function normalizeSigningTemplate(next: SigningTemplateConfig): SigningTemplateConfig {
  const sorted = {
    ...next,
    documents: [...next.documents]
      .sort((a, b) => a.order - b.order)
      .map((doc, index) => ({ ...doc, order: index })),
  };
  return sanitizeSigningTemplateConfig(sorted);
}

function availableSignerRolesForDocument(
  template: SigningTemplateConfig,
  document: SigningTemplateDocument
) {
  const assignedKeys = new Set(document.signer_role_keys);
  return SIGNING_ROLE_REGISTRY.filter((role) => !assignedKeys.has(role.key));
}

function rolesForDocument(template: SigningTemplateConfig, document: SigningTemplateDocument) {
  const keySet = new Set(document.signer_role_keys);
  return template.roles.filter((role) => keySet.has(role.key));
}

export function SigningPackageConfig({
  config,
  onChange,
  postApplicationDocs = [],
}: {
  config: unknown;
  onChange: (config: SigningTemplateConfig) => void;
  /** Post-application supporting docs from the product workflow (categoryKey:docIndex keys). */
  postApplicationDocs?: PostApplicationDocOption[];
}) {
  const template = React.useMemo(() => parseSigningTemplateConfig(config), [config]);
  const [pendingTemplateKey, setPendingTemplateKey] = React.useState<SystemTemplateKey>(
    SYSTEM_SIGNING_TEMPLATES[0].templateKey
  );

  const persist = React.useCallback(
    (next: SigningTemplateConfig) => {
      onChange(normalizeSigningTemplate(next));
    },
    [onChange]
  );

  const availableTemplates = SYSTEM_SIGNING_TEMPLATES.filter(
    (item) => !template.documents.some((doc) => doc.key === item.templateKey)
  );

  const availableSupportingDocs = postApplicationDocs.filter(
    (doc) => !(template.supporting_docs ?? []).some((ref) => ref.step_key === doc.step_key)
  );

  React.useEffect(() => {
    if (availableTemplates.length === 0) return;
    if (!availableTemplates.some((item) => item.templateKey === pendingTemplateKey)) {
      setPendingTemplateKey(availableTemplates[0].templateKey);
    }
  }, [availableTemplates, pendingTemplateKey]);

  const handleEnabledChange = (enabled: boolean) => {
    persist({ ...template, enabled });
  };

  const addDocument = (templateKey: SystemTemplateKey) => {
    const initialRole = defaultRole(template.roles.length);
    const document = createDocumentFromSystemTemplate(
      templateKey,
      template.documents.length,
      initialRole
    );
    persist({
      ...template,
      enabled: true,
      roles: [...template.roles, initialRole],
      documents: [...template.documents, document],
    });
  };

  const addSupportingDoc = (stepKey: string) => {
    const option = postApplicationDocs.find((doc) => doc.step_key === stepKey);
    if (!option) return;
    const initialRole =
      template.roles[0] ?? defaultRole(template.roles.length, "issuer_director");
    const ref: SigningTemplateSupportingDocRef = {
      step_key: option.step_key,
      label: option.label,
      required: true,
      signer_role_keys: [initialRole.key],
    };
    persist({
      ...template,
      enabled: true,
      roles: template.roles.some((role) => role.key === initialRole.key)
        ? template.roles
        : [...template.roles, initialRole],
      supporting_docs: [...(template.supporting_docs ?? []), ref],
    });
  };

  const removeSupportingDoc = (stepKey: string) => {
    persist({
      ...template,
      supporting_docs: (template.supporting_docs ?? []).filter((ref) => ref.step_key !== stepKey),
    });
  };

  const updateSupportingDoc = (
    stepKey: string,
    updates: Partial<SigningTemplateSupportingDocRef>
  ) => {
    persist({
      ...template,
      supporting_docs: (template.supporting_docs ?? []).map((ref) =>
        ref.step_key === stepKey ? { ...ref, ...updates } : ref
      ),
    });
  };

  const removeDocument = (documentKey: string) => {
    const removed = template.documents.find((doc) => doc.key === documentKey);
    if (!removed) return;
    const remainingDocuments = template.documents.filter((doc) => doc.key !== documentKey);
    const remainingRoleKeys = new Set([
      ...remainingDocuments.flatMap((doc) => doc.signer_role_keys),
      ...(template.supporting_docs ?? []).flatMap((ref) => ref.signer_role_keys),
    ]);
    persist({
      ...template,
      documents: remainingDocuments,
      roles: template.roles.filter((role) => remainingRoleKeys.has(role.key)),
    });
  };

  const updateDocument = (documentKey: string, updates: Partial<SigningTemplateDocument>) => {
    persist({
      ...template,
      documents: template.documents.map((doc) =>
        doc.key === documentKey ? { ...doc, ...updates } : doc
      ),
    });
  };

  const updateRole = (
    _documentKey: string,
    roleKey: string,
    updates: Partial<SigningTemplateRole>
  ) => {
    if (
      updates.key &&
      updates.key !== roleKey &&
      template.roles.some((role) => role.key === updates.key)
    ) {
      return;
    }

    const roles = template.roles.map((role) => {
      if (role.key !== roleKey) return role;
      const nextRole = { ...role, ...updates };
      if (updates.key && updates.key !== roleKey) {
        const def = SIGNING_ROLE_REGISTRY.find((item) => item.key === updates.key);
        if (def) nextRole.label = def.label;
      }
      return nextRole;
    });

    let documents = template.documents;
    if (updates.key && updates.key !== roleKey) {
      documents = documents.map((doc) => ({
        ...doc,
        signer_role_keys: doc.signer_role_keys.map((key) => (key === roleKey ? updates.key! : key)),
      }));
    }

    persist({
      ...template,
      roles,
      documents,
      supporting_docs: (template.supporting_docs ?? []).map((ref) => ({
        ...ref,
        signer_role_keys: ref.signer_role_keys.map((key) =>
          key === roleKey && updates.key ? updates.key : key
        ),
      })),
    });
  };

  const addRole = (documentKey: string) => {
    const document = template.documents.find((doc) => doc.key === documentKey);
    if (!document) return;

    const nextRegistryRole = availableSignerRolesForDocument(template, document)[0];
    if (!nextRegistryRole) return;

    const existingRole = template.roles.find((role) => role.key === nextRegistryRole.key);
    const role = existingRole ?? defaultRole(template.roles.length, nextRegistryRole.key);

    persist({
      ...template,
      roles: existingRole ? template.roles : [...template.roles, role],
      documents: template.documents.map((doc) =>
        doc.key === documentKey
          ? { ...doc, signer_role_keys: [...doc.signer_role_keys, role.key] }
          : doc
      ),
    });
  };

  const removeRole = (documentKey: string, roleKey: string) => {
    const document = template.documents.find((doc) => doc.key === documentKey);
    if (!document) return;
    const docRoles = rolesForDocument(template, document);
    if (docRoles.length <= 1) return;

    const documents = template.documents.map((doc) =>
      doc.key === documentKey
        ? { ...doc, signer_role_keys: doc.signer_role_keys.filter((key) => key !== roleKey) }
        : doc
    );
    const remainingRoleKeys = new Set([
      ...documents.flatMap((doc) => doc.signer_role_keys),
      ...(template.supporting_docs ?? []).flatMap((ref) => ref.signer_role_keys),
    ]);
    persist({
      ...template,
      documents,
      roles: template.roles.filter((role) => remainingRoleKeys.has(role.key)),
    });
  };

  return (
    <div className={cn("grid rounded-xl border border-border bg-card p-4 text-sm leading-6", SECTION_GAP)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Signing package</h3>
          <p className="text-sm text-muted-foreground">
            Configure documents and signer roles. Issuers assign people and send signing emails when
            accepting an offer.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
          <Switch checked={template.enabled} onCheckedChange={handleEnabledChange} />
          Enabled
        </label>
      </div>

      {template.enabled ? (
        <>
          {availableTemplates.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="grid min-w-0 flex-1 gap-2 sm:max-w-md">
                <label className="text-xs font-medium text-muted-foreground">Add document</label>
                <Select
                  value={pendingTemplateKey}
                  onValueChange={(value) => setPendingTemplateKey(value as SystemTemplateKey)}
                >
                  <SelectTrigger className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Select a document" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTemplates.map((item) => (
                      <SelectItem key={item.templateKey} value={item.templateKey}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 sm:mb-0.5"
                onClick={() => addDocument(pendingTemplateKey)}
              >
                <PlusIcon className="h-4 w-4" />
                Add document
              </Button>
            </div>
          ) : null}

          {postApplicationDocs.length > 0 ? (
            <div className="grid gap-3 rounded-lg border border-border bg-muted/15 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Post-application documents</p>
                  <p className="text-xs text-muted-foreground">
                    Issuer-uploaded supporting docs that also require signatures.
                  </p>
                </div>
                {availableSupportingDocs.length > 0 ? (
                  <Select onValueChange={(value) => addSupportingDoc(value)}>
                    <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, "w-full sm:w-[240px]")}>
                      <SelectValue placeholder="Add supporting doc" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSupportingDocs.map((doc) => (
                        <SelectItem key={doc.step_key} value={doc.step_key}>
                          {doc.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
              {(template.supporting_docs ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No post-application docs selected yet.</p>
              ) : (
                <ul className="grid gap-2">
                  {(template.supporting_docs ?? []).map((ref) => (
                    <li
                      key={ref.step_key}
                      className="flex flex-col gap-2 rounded-lg bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium">{ref.label}</p>
                        <p className="text-xs text-muted-foreground">Requires issuer upload at offer time</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={ref.signer_role_keys[0] ?? ""}
                          onValueChange={(value) =>
                            updateSupportingDoc(ref.step_key, { signer_role_keys: [value] })
                          }
                        >
                          <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, "h-8 w-[160px]")}>
                            <SelectValue placeholder="Signer role" />
                          </SelectTrigger>
                          <SelectContent>
                            {template.roles.map((role) => (
                              <SelectItem key={role.key} value={role.key}>
                                {role.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSupportingDoc(ref.step_key)}
                          aria-label={`Remove ${ref.label}`}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {template.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents yet. Select a system template above and click Add document.
            </p>
          ) : (
            <ul className="grid gap-4">
              {template.documents.map((document) => {
                const systemTemplate = SYSTEM_SIGNING_TEMPLATES.find(
                  (item) => item.templateKey === document.key
                );
                const documentRoles = rolesForDocument(template, document);
                const canAddSignerRole = availableSignerRolesForDocument(template, document).length > 0;

                return (
                  <li
                    key={document.key}
                    className="grid gap-4 rounded-lg border border-border bg-muted/15 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">
                          {systemTemplate?.label ?? document.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {systemTemplate?.description ?? "System template — not uploaded"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <Switch
                            checked={document.required}
                            onCheckedChange={(required) =>
                              updateDocument(document.key, { required })
                            }
                          />
                          Required
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeDocument(document.key)}
                          aria-label={`Remove ${document.name}`}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 border-t border-border pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Signers at offer time
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Roles the issuer fills in when accepting this offer.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => addRole(document.key)}
                          disabled={!canAddSignerRole}
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add signer
                        </Button>
                      </div>

                      {documentRoles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Add at least one signer.</p>
                      ) : (
                        <ul className="grid gap-3">
                          {documentRoles.map((role) => (
                            <li key={role.key} className="grid gap-2 rounded-lg bg-background p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Select
                                  value={role.key}
                                  onValueChange={(value) =>
                                    updateRole(document.key, role.key, {
                                      key: value as SigningRoleKey,
                                    })
                                  }
                                >
                                  <SelectTrigger className={cn(SELECT_TRIGGER_CLASS, "h-8 w-[180px]")}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SIGNING_ROLE_REGISTRY.map((def) => {
                                      const takenByOtherRole = template.roles.some(
                                        (entry) => entry.key === def.key && entry.key !== role.key
                                      );
                                      return (
                                        <SelectItem
                                          key={def.key}
                                          value={def.key}
                                          disabled={takenByOtherRole}
                                        >
                                          {def.label}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeRole(document.key, role.key)}
                                  aria-label="Remove signer"
                                  disabled={documentRoles.length === 1}
                                >
                                  <TrashIcon className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                <label className="flex items-center gap-1.5">
                                  Min at offer
                                  <Input
                                    type="number"
                                    min={0}
                                    value={role.min_count}
                                    onChange={(event) =>
                                      updateRole(document.key, role.key, {
                                        min_count: Math.max(
                                          0,
                                          Number.parseInt(event.target.value, 10) || 0
                                        ),
                                      })
                                    }
                                    className={cn(INPUT_CLASS, "h-8 w-20")}
                                  />
                                </label>
                                <label className="flex items-center gap-1.5">
                                  Max at offer
                                  <Input
                                    type="number"
                                    min={1}
                                    value={role.max_count ?? ""}
                                    placeholder="No limit"
                                    onChange={(event) => {
                                      const raw = event.target.value.trim();
                                      updateRole(document.key, role.key, {
                                        max_count:
                                          raw === ""
                                            ? null
                                            : Math.max(1, Number.parseInt(raw, 10) || 1),
                                      });
                                    }}
                                    className={cn(INPUT_CLASS, "h-8 w-24")}
                                  />
                                </label>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
