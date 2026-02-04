"use client";

import * as React from "react";
import { CheckIcon } from "@heroicons/react/24/solid";

interface ProgressIndicatorProps {
  steps: string[];
  currentStep: number;
  isLoading?: boolean;
}

export function ProgressIndicator({
  steps,
  currentStep,
  isLoading = false,
}: ProgressIndicatorProps) {
  if (false) {
    return (
      <div className="mt-3">
  <div className="relative flex items-start justify-between">
    {steps.map((_, index) => (
      <div
        key={index}
        className="relative flex flex-1 flex-col items-center min-w-0"
      >
        {/* Connector skeleton */}
        {index !== 0 && (
          <div
            className="absolute left-[-50%] w-full z-0 rounded-full bg-muted"
            style={{
              top: "16.5px",
              height: "3px",
            }}
          />
        )}

        {/* Circle anchor */}
        <div className="relative flex items-center justify-center h-[36px] w-[36px]">
          <div className="absolute inset-0 rounded-full bg-background opacity-0 z-10" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent z-20" />

          <div className="relative z-30 flex items-center justify-center rounded-full h-[28px] w-[28px] bg-muted animate-pulse">
            <div className="h-[8px] w-[8px] rounded-full opacity-0" />
          </div>
        </div>

        {/* Label skeleton — nudged down */}
           <div className="mt-[12px] h-[12px] w-[72px] rounded bg-muted animate-pulse" />
        {/* <div className="mt-[11px] h-[12px] w-[72px] rounded bg-muted animate-pulse" /> */}
      </div>
    ))}
  </div>
</div>

    )
    return (
      <div className="mt-3">
  <div className="relative flex items-start justify-between">
    {steps.map((_, index) => (
      <div
        key={index}
        className="relative flex flex-1 flex-col items-center min-w-0"
      >
        {/* Connector skeleton */}
        {index !== 0 && (
          <div
            className="absolute left-[-50%] w-full z-0 rounded-full bg-muted"
            style={{
              top: "14px",
              height: "4px",
            }}
          />
        )}

        {/* Circle anchor — EXACT STRUCTURE MATCH */}
        <div className="relative flex items-center justify-center h-[32px] w-[32px]">
          {/* Mask ring (invisible) */}
          <div className="absolute inset-0 rounded-full bg-background opacity-0 z-10" />

          {/* Halo border (invisible but present) */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent z-20" />

          {/* Step circle skeleton */}
          <div className="relative z-30 flex items-center justify-center rounded-full h-[24px] w-[24px] bg-muted animate-pulse">
            {/* Inner dot placeholder (INVISIBLE, but REQUIRED) */}
            <div className="h-[8px] w-[8px] rounded-full opacity-0" />
          </div>
        </div>

        {/* Label skeleton */}
        {/* <div className="mt-2 h-[12px] w-[70px] rounded bg-muted animate-pulse" /> */}
        <div className="mt-[10px] h-[12px] w-[70px] rounded bg-muted animate-pulse" />

      </div>
    ))}
  </div>
</div>

    )
    return (
      <div className="mt-3">
  <div className="relative flex items-start justify-between">
    {steps.map((_, index) => (
      <div
        key={index}
        className="relative flex flex-1 flex-col items-center min-w-0"
      >
        {/* Connector skeleton */}
        {index !== 0 && (
          <div
            className="absolute left-[-50%] w-full z-0 rounded-full bg-muted"
            style={{
              top: "14px",
              height: "4px",
            }}
          />
        )}

        {/* Circle anchor (STRUCTURE MATCHES REAL) */}
        <div className="relative flex items-center justify-center h-[32px] w-[32px]">
          {/* Mask ring (invisible, keeps geometry) */}
          <div className="absolute inset-0 rounded-full bg-background opacity-0 z-10" />

          {/* Halo border (invisible, keeps geometry) */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent z-20" />

          {/* Step circle skeleton */}
          <div className="relative z-30 h-[24px] w-[24px] rounded-full bg-muted animate-pulse" />
        </div>

        {/* Label skeleton */}
        <div className="mt-2 h-[12px] w-[70px] rounded bg-muted animate-pulse" />
      </div>
    ))}
  </div>
</div>

    )
    return (
      <div className="mt-3">
  <div className="relative flex items-start justify-between">
    {steps.map((_, index) => (
      <div
        key={index}
        className="relative flex flex-1 flex-col items-center min-w-0"
      >
        {/* Connector skeleton */}
        {index !== 0 && (
          <div
            className="absolute left-[-50%] w-full z-0 rounded-full bg-muted"
            style={{
              top: "14px",
              height: "4px",
            }}
          />
        )}

        {/* Circle anchor */}
        <div className="relative flex items-center justify-center h-[32px] w-[32px]">
          {/* Halo skeleton */}
          <div className="absolute inset-0 rounded-full bg-muted/50" />

          {/* Step circle skeleton */}
          <div className="relative z-10 h-[24px] w-[24px] rounded-full bg-muted animate-pulse" />
        </div>

        {/* Label skeleton */}
        <div className="mt-2 h-[12px] w-[70px] rounded bg-muted animate-pulse" />
      </div>
    ))}
  </div>
</div>

    )
    return (
      <div className="mt-3">
  <div className="relative flex items-start justify-between">
    {steps.map((_, index) => {
      return (
        <div
          key={index}
          className="relative flex flex-1 flex-col items-center min-w-0"
        >
          {/* Connector skeleton */}
          {index !== 0 && (
            <div
              className="absolute left-[-50%] top-[14px] w-full z-0 bg-muted"
              style={{ height: "2px" }}
            />
          )}

          {/* Circle anchor */}
          <div className="relative flex items-center justify-center h-[30px] w-[30px]">
            {/* Halo skeleton */}
            <div className="absolute inset-0 rounded-full bg-muted/50" />

            {/* Step circle skeleton */}
            <div className="relative z-10 h-[22px] w-[22px] rounded-full bg-muted animate-pulse" />
          </div>

          {/* Label skeleton */}
          <div className="mt-2 h-[12px] w-[70px] rounded bg-muted animate-pulse" />
        </div>
      );
    })}
  </div>
</div>

    )

    return (
      <div className="relative flex items-start justify-between w-full overflow-x-auto min-h-[60px] md:min-h-[72px]">
        <div className="flex items-start justify-between w-full min-w-max md:min-w-0">
          {steps.map((_, index) => (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center z-10 flex-1 min-w-[60px] md:min-w-0">
                <div className="relative size-6 md:size-8 flex items-center justify-center">
                  <div className="size-5 md:size-6 rounded-full bg-muted animate-pulse" />
                </div>
                <div className="text-xs md:text-sm mt-1.5 md:mt-2 text-center px-1">
                  <div className="h-3 w-16 bg-muted animate-pulse rounded mx-auto" />
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className="hidden md:block absolute top-3 md:top-4 z-0 bg-border"
                  style={{
                    left: `calc(${(index + 0.5) * (100 / steps.length)}% + 12px)`,
                    width: `calc(${100 / steps.length}% - 24px)`,
                    height: '1.5px',
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3">
  <div className="relative flex items-start justify-between">
    {steps.map((label, index) => {
      const stepNumber = index + 1;
      const isCompleted = stepNumber < currentStep;
      const isActive = stepNumber === currentStep;
      const isFilled = isCompleted || isActive;

      return (
        <div
          key={label}
          className="relative flex flex-1 flex-col items-center min-w-0"
        >
          {/* Connector — slightly thinner */}
          {index !== 0 && (
            <div
              className={`absolute left-[-50%] w-full z-0 rounded-full ${
                isFilled ? "bg-foreground" : "bg-border"
              }`}
              style={{
                top: "16.5px",
                height: "3px",
              }}
            />
          )}

          {/* Circle anchor */}
          <div className="relative flex items-center justify-center h-[36px] w-[36px]">
            {isActive && (
              <>
                <div className="absolute inset-0 rounded-full bg-background z-10" />
                <div className="absolute inset-0 rounded-full border-2 border-foreground z-20" />
              </>
            )}

            {/* Step circle */}
            <div
              className={`relative z-30 flex items-center justify-center rounded-full
                h-[28px] w-[28px]
                ${
                  isFilled
                    ? "border-2 border-foreground bg-foreground"
                    : "border-2 border-border bg-background"
                }
              `}
            >
              <div
                className={`h-[8px] w-[8px] rounded-full ${
                  isFilled ? "bg-background" : "bg-border"
                }`}
              />
            </div>
          </div>

          {/* Label */}
          <span
            className={`mt-2.5 text-center text-[12px] leading-snug max-w-[90px] ${
              isActive
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {label}
          </span>
        </div>
      );
    })}
  </div>
</div>

  )

  return (
    <div className="mt-3">
  <div className="relative flex items-start justify-between">
    {steps.map((label, index) => {
      const stepNumber = index + 1;
      const isCompleted = stepNumber < currentStep;
      const isActive = stepNumber === currentStep;
      const isFilled = isCompleted || isActive;

      return (
        <div
          key={label}
          className="relative flex flex-1 flex-col items-center min-w-0"
        >
          {/* Connector */}
          {index !== 0 && (
            <div
              className={`absolute left-[-50%] w-full z-0 rounded-full ${
                isFilled ? "bg-foreground" : "bg-border"
              }`}
              style={{
                top: "14px", // centered for 4px bar inside 32px anchor
                height: "4px",
              }}
            />
          )}

          {/* Circle anchor */}
          <div className="relative flex items-center justify-center h-[32px] w-[32px]">
            {/* Active halo */}
            {isActive && (
              <>
                {/* Mask ring */}
                <div className="absolute inset-0 rounded-full bg-background z-10" />
                {/* Halo border */}
                <div className="absolute inset-0 rounded-full border-2 border-foreground z-20" />
              </>
            )}

            {/* Step circle */}
            <div
              className={`relative z-30 flex items-center justify-center rounded-full
                h-[24px] w-[24px]
                ${
                  isFilled
                    ? "border-2 border-foreground bg-foreground"
                    : "border-2 border-border bg-background"
                }
              `}
            >
              <div
                className={`h-[8px] w-[8px] rounded-full ${
                  isFilled ? "bg-background" : "bg-border"
                }`}
              />
            </div>
          </div>

          {/* Label */}
          <span
            className={`mt-2 text-center text-[12px] leading-snug max-w-[90px] ${
              isActive
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            }`}
          >
            {label}
          </span>
        </div>
      );
    })}
  </div>
</div>

  )

  return (
    <div className="mt-3">
      <div className="relative flex items-start justify-between">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isFilled = isCompleted || isActive;

          return (
            <div
              key={label}
              className="relative flex flex-1 flex-col items-center min-w-0"
            >
              {/* Connector */}
{index !== 0 && (
  <div
    className={`absolute left-[-50%] top-[14px] w-full z-0 ${
      isFilled ? "bg-foreground" : "bg-border"
    }`}
    style={{ height: "2px" }}
  />
)}


              {/* Circle anchor */}
              <div className="relative flex items-center justify-center h-[30px] w-[30px]">
                {/* Active halo */}
                {isActive && (
                  <>
                    {/* Mask ring (hides connector) */}
                    <div className="absolute inset-0 rounded-full bg-background z-10" />

                    {/* Halo border */}
                    <div className="absolute inset-0 rounded-full border-2 border-foreground z-20" />
                  </>
                )}


                {/* Step circle */}
                <div
                  className={`relative z-30 flex items-center justify-center rounded-full h-[22px] w-[22px]
                  ${isFilled
                      ? "border-2 border-foreground bg-foreground"
                      : "border-2 border-border bg-background"
                    }
                  `}
                >

                  {/* Inner dot */}
                  <div
                    className={`h-[8px] w-[8px] rounded-full ${isFilled ? "bg-background" : "bg-border"
                      }`}
                  />
                </div>
              </div>

              {/* Label */}
              <span
                className={`mt-2 text-center text-[12px] leading-snug max-w-[90px] ${isActive
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
                  }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>

  )

  return (
    <div className="relative flex items-start justify-between w-full overflow-x-auto min-h-[60px] md:min-h-[72px]">
      <div className="flex items-start justify-between w-full min-w-max md:min-w-0">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <React.Fragment key={index}>
              <div className="flex flex-col items-center z-10 flex-1 min-w-[60px] md:min-w-0">
                <div className="relative size-6 md:size-8 flex items-center justify-center">
                  {isCompleted ? (
                    <div className="size-5 md:size-6 flex items-center justify-center rounded-full bg-foreground text-background">
                      <CheckIcon className="h-2.5 w-2.5 md:h-3 md:w-3" />
                    </div>
                  ) : isCurrent ? (
                    <div className="size-6 md:size-8 rounded-full border-2 border-foreground flex items-center justify-center bg-background">
                      <div className="size-5 md:size-6 flex items-center justify-center rounded-full bg-foreground">
                        <div className="size-1 md:size-1.5 rounded-full bg-background" />
                      </div>
                    </div>
                  ) : (
                    <div className="size-5 md:size-6 flex items-center justify-center rounded-full bg-background border-2 border-muted-foreground/30">
                      <div className="size-1 md:size-1.5 rounded-full bg-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div
                  className={`text-xs md:text-sm mt-1.5 md:mt-2 text-center px-1 ${isCurrent
                    ? "text-foreground font-semibold"
                    : isCompleted
                      ? "text-foreground"
                      : "text-muted-foreground/70"
                    }`}
                >
                  {step}
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`hidden md:block absolute top-3 md:top-4 z-0 ${stepNumber < currentStep ? "bg-foreground" : "bg-muted-foreground/30"
                    }`}
                  style={{
                    left: `calc(${(index + 0.5) * (100 / steps.length)}% + 12px)`,
                    width: `calc(${100 / steps.length}% - 24px)`,
                    height: '1.5px',
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
