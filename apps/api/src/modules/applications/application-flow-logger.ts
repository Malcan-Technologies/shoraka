import { logger } from "../../lib/logger";
import type { IssuerActivityLogContext } from "./logs/types";

export type ApplicationFlowLogLevel = "info" | "warn" | "error" | "debug";
export type ApplicationFlowResult = "STARTED" | "SUCCESS" | "VALIDATION_FAILED" | "FAILED";

export type ApplicationFlowLogEvent =
  | "APPLICATION_STEP_ACTION_STARTED"
  | "APPLICATION_STEP_ACTION_SUCCESS"
  | "APPLICATION_STEP_VALIDATION_FAILED"
  | "APPLICATION_STEP_ACTION_FAILED"
  | "APPLICATION_STATUS_ACTION_STARTED"
  | "APPLICATION_STATUS_ACTION_SUCCESS"
  | "APPLICATION_STATUS_VALIDATION_FAILED"
  | "APPLICATION_STATUS_ACTION_FAILED"
  | "APPLICATION_CREATED_STARTED"
  | "APPLICATION_CREATED_SUCCESS"
  | "APPLICATION_CREATED_FAILED";

function correlationIdFromLogContext(logContext?: IssuerActivityLogContext | null): string | null {
  return logContext?.context?.correlationId ?? null;
}

export function safeServerErrorMessage(err: unknown): string {
  if (process.env.NODE_ENV !== "production") {
    return err instanceof Error ? err.message : String(err);
  }
  return "An unexpected error occurred";
}

export function logApplicationFlowEvent(params: {
  level: ApplicationFlowLogLevel;
  event: ApplicationFlowLogEvent;
  result: ApplicationFlowResult;
  message?: string;
  correlationId?: string | null;
  // Identifiers
  applicationId?: string | null;
  applicationReference?: string | null;
  productId?: string | null;
  productCode?: string | null;
  productVersion?: number | null;
  issuerOrganizationId?: string | null;
  userId?: string | null;
  // Configured step info
  configuredStepId?: string | null;
  stepKey?: string | null;
  stepName?: string | null;
  action?: string | null;
  validationRule?: string | null;
  // Status / state
  applicationStatus?: string | null;
  previousStatus?: string | null;
  nextStepNumber?: number | null;
  // Downstream info
  downstreamIntegration?: string | null;
  // Errors
  errorCode?: string | null;
  errorType?: string | null;
  safeErrorMessage?: string | null;
  errorStack?: string | null;
  // Diagnostics
  durationMs?: number | null;
  endpoint?: string | null;
  method?: string | null;
}) {
  const {
    level,
    event,
    result,
    message,
    correlationId,
    applicationId,
    applicationReference,
    productId,
    productCode,
    productVersion,
    issuerOrganizationId,
    userId,
    configuredStepId,
    stepKey,
    stepName,
    action,
    validationRule,
    applicationStatus,
    previousStatus,
    nextStepNumber,
    downstreamIntegration,
    errorCode,
    errorType,
    safeErrorMessage,
    errorStack,
    durationMs,
    endpoint,
    method,
  } = params;

  logger[level](
    {
      correlationId: correlationId ?? null,
      result,
      applicationId: applicationId ?? null,
      applicationReference: applicationReference ?? null,
      productId: productId ?? null,
      productCode: productCode ?? null,
      productVersion: productVersion ?? null,
      issuerOrganizationId: issuerOrganizationId ?? null,
      userId: userId ?? null,
      configuredStepId: configuredStepId ?? null,
      stepKey: stepKey ?? null,
      stepName: stepName ?? null,
      action: action ?? null,
      applicationStatus: applicationStatus ?? null,
      previousStatus: previousStatus ?? null,
      nextStepNumber: nextStepNumber ?? null,
      validationRule: validationRule ?? null,
      downstreamIntegration: downstreamIntegration ?? null,
      errorCode: errorCode ?? null,
      errorType: errorType ?? null,
      safeErrorMessage: safeErrorMessage ?? null,
      endpoint: endpoint ?? null,
      method: method ?? null,
      durationMs: durationMs ?? null,
      ...(level === "error" ? { errorStack: errorStack ?? null } : {}),
    },
    message ?? event
  );
}

export function logApplicationStepAction(params: {
  level: ApplicationFlowLogLevel;
  event: ApplicationFlowLogEvent;
  result: ApplicationFlowResult;
  logContext?: IssuerActivityLogContext | null;
  correlationId?: string | null;
  applicationId: string;
  applicationReference?: string | null;
  productId?: string | null;
  productCode?: string | null;
  productVersion?: number | null;
  issuerOrganizationId?: string | null;
  userId: string | null;
  configuredStepId: string | null;
  stepKey: string | null;
  stepName?: string | null;
  action?: string | null;
  validationRule?: string | null;
  applicationStatus?: string | null;
  previousStatus?: string | null;
  nextStepNumber?: number | null;
  downstreamIntegration?: string | null;
  errorCode?: string | null;
  errorType?: string | null;
  safeErrorMessage?: string | null;
  errorStack?: string | null;
  durationMs?: number | null;
  endpoint?: string | null;
  method?: string | null;
}) {
  logApplicationFlowEvent({
    ...params,
    correlationId: params.correlationId ?? correlationIdFromLogContext(params.logContext),
  });
}

