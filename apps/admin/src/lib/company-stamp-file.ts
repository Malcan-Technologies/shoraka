import {
  companyStampDeclaredFileRejection,
  companyStampLayoutRejection,
} from "@cashsouk/types";

export function companyStampFileMetaRejection(file: { type: string; size: number }): string | null {
  return companyStampDeclaredFileRejection(file.type, file.size);
}

export function companyStampImageLayoutRejection(width: number, height: number): string | null {
  return companyStampLayoutRejection(width, height);
}

async function readImageSizeFromObjectUrl(file: File): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("unreadable"));
      image.src = url;
    });
    return size;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function readCompanyStampImageSize(
  file: File
): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  }
  return readImageSizeFromObjectUrl(file);
}

/** Client-side stamp checks. Server confirm still inspects the uploaded bytes. */
export async function validateCompanyStampFile(file: File): Promise<string | null> {
  const declared = companyStampFileMetaRejection(file);
  if (declared) return declared;
  try {
    const { width, height } = await readCompanyStampImageSize(file);
    return companyStampImageLayoutRejection(width, height);
  } catch {
    return companyStampDeclaredFileRejection("application/octet-stream", file.size);
  }
}
