/**
 * Operator-profile code must not import the signing provider HTTP client.
 */
export {
  confirmLegalImageFromS3,
  confirmSigningCloudLegalImageFromS3,
  type ConfirmedLegalImage,
  type ConfirmedSigningCloudLegalImage,
} from "../legal-images";
