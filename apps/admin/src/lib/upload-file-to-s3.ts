/**
 * Upload a file to S3 using a presigned URL.
 */
export async function uploadFileToS3(
  uploadUrl: string,
  file: File
): Promise<Response> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
    },
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response;
}
