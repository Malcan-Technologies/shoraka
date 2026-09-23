export async function openAdminDocumentBlobInNewTab(
  loadBlob: () => Promise<{ blob: Blob; filename: string }>,
  blockedMessage: string
) {
  const tab = window.open("about:blank", "_blank");
  if (!tab) {
    throw new Error(blockedMessage);
  }
  tab.opener = null;
  try {
    const { blob } = await loadBlob();
    const objectUrl = URL.createObjectURL(blob);
    tab.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    tab.close();
    throw error;
  }
}

export function downloadAdminDocumentBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
