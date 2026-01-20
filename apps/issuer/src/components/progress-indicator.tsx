"use client";

import * as React from "react";
import { CheckIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";

interface ProgressIndicatorProps {
  steps: readonly string[];
  currentStep: number;
}

export function ProgressIndicator({ steps, currentStep }: ProgressIndicatorProps) {
  return (
    <div className="w-full">
      <div className="relative">
        <div className="relative flex items-start justify-between">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            const showConnector = index < steps.length - 1;
            const connectorIsCompleted = index < currentStep;

            return (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center relative z-10 flex-1">
                  <div className="relative">
                    <div
                      className={cn(
                        "flex items-center justify-center rounded-full transition-colors relative",
                        isActive
                          ? "w-8 h-8 bg-black border-2 border-black"
                          : isCompleted
                          ? "w-8 h-8 bg-black border-2 border-black"
                          : "w-8 h-8 border-2 bg-background border-zinc-300"
                      )}
                    >
                      {isActive ? (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      ) : isCompleted ? (
                        <CheckIcon className="w-4 h-4 text-white" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-zinc-300" />
                      )}
                    </div>
                    {isActive && (
                      <div className="absolute -inset-1 rounded-full border-2 border-black pointer-events-none" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "mt-2 text-xs text-center max-w-[100px] leading-tight",
                      isActive || isCompleted
                        ? "font-semibold text-black"
                        : "font-normal text-zinc-500"
                    )}
                  >
                    {step}
                  </span>
                </div>
                {showConnector && (
                  <div
                    className={cn(
                      "absolute top-4 z-0",
                      connectorIsCompleted ? "bg-black h-[2px]" : "bg-zinc-200 h-px"
                    )}
                    style={{
                      left: `calc(${((index + 0.5) / steps.length) * 100}% + 16px)`,
                      right: `calc(${((steps.length - index - 1.5) / steps.length) * 100}% + 16px)`,
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
