export type ApplicationDocumentAuditChange = {
  eventType: "APPLICATION_DOCUMENT_UPLOADED" | "APPLICATION_DOCUMENT_REMOVED" | "APPLICATION_DOCUMENT_REPLACED";
  identity: string;
  documentCategory: string;
  slotName?: string;
  workflowId?: string;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  fileHash?: string;
};

type FileFingerprint = {
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  fileHash?: string;
  s3Key?: string;
};

type DocumentSlot = {
  identity: string;
  documentCategory: string;
  slotName?: string;
  workflowId?: string;
  files: FileFingerprint[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function fileFromRecord(raw: unknown): FileFingerprint | null {
  const record = asRecord(raw);
  if (!record) return null;
  const fileName =
    (typeof record.file_name === "string" && record.file_name) ||
    (typeof record.fileName === "string" && record.fileName) ||
    undefined;
  const fileSizeRaw = record.file_size ?? record.fileSize ?? record.fileSizeBytes;
  const fileSizeBytes = typeof fileSizeRaw === "number" && Number.isFinite(fileSizeRaw) ? fileSizeRaw : undefined;
  const mimeType =
    (typeof record.mime_type === "string" && record.mime_type) ||
    (typeof record.mimeType === "string" && record.mimeType) ||
    (typeof record.content_type === "string" && record.content_type) ||
    undefined;
  const fileHash =
    (typeof record.file_hash === "string" && record.file_hash) ||
    (typeof record.sha256 === "string" && record.sha256) ||
    undefined;
  const s3Key = typeof record.s3_key === "string" ? record.s3_key : undefined;
  if (!fileName && !s3Key && fileSizeBytes == null) return null;
  return { fileName, fileSizeBytes, mimeType, fileHash, s3Key };
}

function filesFromDoc(record: Record<string, unknown>): FileFingerprint[] {
  const files: FileFingerprint[] = [];
  const single = fileFromRecord(record.file);
  if (single) files.push(single);
  if (Array.isArray(record.files)) {
    for (const item of record.files) {
      const parsed = fileFromRecord(item);
      if (parsed) files.push(parsed);
    }
  }
  return files;
}

function slotFingerprint(files: FileFingerprint[]): string {
  return files
    .map((file) => `${file.s3Key ?? ""}|${file.fileName ?? ""}|${file.fileSizeBytes ?? ""}`)
    .sort()
    .join(";;");
}

function collectSupportingSlots(data: unknown): DocumentSlot[] {
  const root = asRecord(data);
  if (!root) return [];
  const nested = asRecord(root.supporting_documents);
  const categoriesRaw = Array.isArray(root.categories)
    ? root.categories
    : nested && Array.isArray(nested.categories)
      ? nested.categories
      : [];
  const slots: DocumentSlot[] = [];
  for (const category of categoriesRaw) {
    const cat = asRecord(category);
    if (!cat) continue;
    const categoryKey =
      (typeof cat.category_key === "string" && cat.category_key) ||
      (typeof cat.key === "string" && cat.key) ||
      (typeof cat.id === "string" && cat.id) ||
      "supporting_documents";
    const docs = Array.isArray(cat.documents) ? cat.documents : [];
    docs.forEach((doc, index) => {
      const record = asRecord(doc);
      if (!record) return;
      const workflowIndex =
        typeof record.workflow_document_index === "number"
          ? String(record.workflow_document_index)
          : undefined;
      const title = typeof record.title === "string" ? record.title : undefined;
      const slotName = workflowIndex ?? title ?? String(index);
      slots.push({
        identity: `supporting:${categoryKey}:${slotName}`,
        documentCategory: categoryKey,
        slotName,
        files: filesFromDoc(record),
      });
    });
  }
  return slots;
}

function collectAcceptanceSlots(data: unknown): DocumentSlot[] {
  const root = asRecord(data);
  const docs = Array.isArray(root?.documents)
    ? root.documents
    : Array.isArray(data)
      ? data
      : [];
  const slots: DocumentSlot[] = [];
  docs.forEach((doc, index) => {
    const record = asRecord(doc);
    if (!record) return;
    const workflowIndex =
      typeof record.workflow_document_index === "number"
        ? String(record.workflow_document_index)
        : undefined;
    const title = typeof record.title === "string" ? record.title : undefined;
    const slotName = workflowIndex ?? title ?? String(index);
    slots.push({
      identity: `acceptance:${slotName}`,
      documentCategory: "acceptance_documents",
      slotName,
      workflowId: workflowIndex,
      files: filesFromDoc(record),
    });
  });
  return slots;
}

function diffSlots(before: DocumentSlot[], after: DocumentSlot[]): ApplicationDocumentAuditChange[] {
  const beforeMap = new Map(before.map((slot) => [slot.identity, slot]));
  const afterMap = new Map(after.map((slot) => [slot.identity, slot]));
  const changes: ApplicationDocumentAuditChange[] = [];

  for (const [identity, next] of afterMap) {
    const prev = beforeMap.get(identity);
    const nextHasFile = next.files.length > 0;
    const prevHasFile = Boolean(prev && prev.files.length > 0);
    const primary = next.files[0] ?? prev?.files[0];
    const meta = {
      identity,
      documentCategory: next.documentCategory,
      slotName: next.slotName,
      workflowId: next.workflowId,
      fileName: primary?.fileName,
      fileSizeBytes: primary?.fileSizeBytes,
      mimeType: primary?.mimeType,
      fileHash: primary?.fileHash,
    };
    if (!prev || (!prevHasFile && nextHasFile)) {
      if (nextHasFile) {
        changes.push({ eventType: "APPLICATION_DOCUMENT_UPLOADED", ...meta });
      }
      continue;
    }
    if (prevHasFile && !nextHasFile) {
      const removed = prev.files[0];
      changes.push({
        eventType: "APPLICATION_DOCUMENT_REMOVED",
        ...meta,
        fileName: removed?.fileName,
        fileSizeBytes: removed?.fileSizeBytes,
        mimeType: removed?.mimeType,
        fileHash: removed?.fileHash,
      });
      continue;
    }
    if (prevHasFile && nextHasFile && slotFingerprint(prev.files) !== slotFingerprint(next.files)) {
      changes.push({ eventType: "APPLICATION_DOCUMENT_REPLACED", ...meta });
    }
  }

  for (const [identity, prev] of beforeMap) {
    if (afterMap.has(identity)) continue;
    if (prev.files.length === 0) continue;
    const primary = prev.files[0];
    changes.push({
      eventType: "APPLICATION_DOCUMENT_REMOVED",
      identity,
      documentCategory: prev.documentCategory,
      slotName: prev.slotName,
      workflowId: prev.workflowId,
      fileName: primary?.fileName,
      fileSizeBytes: primary?.fileSizeBytes,
      mimeType: primary?.mimeType,
      fileHash: primary?.fileHash,
    });
  }

  return changes;
}

export function diffSupportingDocuments(
  previous: unknown,
  next: unknown
): ApplicationDocumentAuditChange[] {
  return diffSlots(collectSupportingSlots(previous), collectSupportingSlots(next));
}

export function diffAcceptanceDocuments(
  previous: unknown,
  next: unknown
): ApplicationDocumentAuditChange[] {
  return diffSlots(collectAcceptanceSlots(previous), collectAcceptanceSlots(next));
}
