"use client";

/** Imports
 *
 * What: Shared selectable card UI for application steps.
 * Why: Financing Type, Financing Structure, and Review need identical card layout.
 * Data: Accepts slots for leading content (icon/radio), main text, and optional trailing content.
 */
import * as React from "react";
import { cn } from "@/lib/utils";

/** Helpers
 *
 * What: Shared classnames derived from brand + screenshots.
 * Why: Keep border thickness, radius, padding, typography consistent everywhere.
 * Data: Pure strings used by the `SelectionCard` render.
 */
const cardBaseClassName = "w-full rounded-xl border border-input bg-card text-foreground transition-colors";
const cardUnselectedClassName = "border-input hover:border-primary/50";
const cardSelectedClassName = "border-primary bg-card";
const cardPaddingClassName = "px-4 py-3";
const cardFocusClassName =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const titleClassName = "text-base font-semibold text-foreground leading-tight";
const descriptionClassName = "text-sm text-muted-foreground mt-0.5 leading-snug";

export type SelectionCardProps = {
  /** What: Title shown as primary line.
   * Why: Matches screenshots where card title is stronger than description.
   * Data: Plain string, required.
   */
  title: string;
  /** What: Description shown as secondary line.
   * Why: Matches screenshots where description is muted.
   * Data: Plain string, required.
   */
  description: string;
  /** What: Selected state.
   * Why: Controls border color and optional indicator visuals.
   * Data: boolean.
   */
  isSelected: boolean;
  /** What: Click handler.
   * Why: Card is the primary hit target for selection.
   * Data: void callback.
   */
  onClick: () => void;
  /** What: Optional leading slot (icon, radio indicator, etc.).
   * Why: Financing Type uses product image; Financing Structure uses radio dot.
   * Data: ReactNode.
   */
  leading?: React.ReactNode;
  /** What: Optional trailing slot (dropdown, actions).
   * Why: Financing Structure needs the contract Select aligned right.
   * Data: ReactNode.
   */
  trailing?: React.ReactNode;
  /** What: Optional outer class overrides.
   * Why: Allow step-level layout without changing canonical styles.
   * Data: Tailwind class string.
   */
  className?: string;
  /** What: Disabled flag to prevent interaction while keeping visual parity.
   * Why: Edit/Review use-cases show the card but must not be clickable.
   * Data: boolean
   */
  disabled?: boolean;
};

/** Render blocks
 *
 * What: One consistent selectable card.
 * Why: Removes per-step card divergence and keeps spacing stable.
 * Data: Renders a keyboard-accessible button-like div.
 */
export function SelectionCard({
  title,
  description,
  isSelected,
  onClick,
  leading,
  trailing,
  className,
  disabled = false,
}: SelectionCardProps) {
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled ? true : undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn("block w-full cursor-pointer", cardFocusClassName, className)}
    >
      <div
        className={cn(
          cardBaseClassName,
          cardPaddingClassName,
          isSelected ? cardSelectedClassName : cardUnselectedClassName,
          "min-h-[80px] flex items-center"
        )}
      >
        <div className="flex w-full justify-between gap-3">
          <div className="flex gap-3 min-w-0">
            {leading ? <div className="shrink-0">{leading}</div> : null}
            <div className="min-w-0 flex-1">
              <div className={cn(titleClassName, "truncate")}>{title}</div>
              <div className={cn(descriptionClassName, "truncate")}>
                {description}
              </div>
            </div>
          </div>
          {trailing ? <div className="shrink-0">{trailing}</div> : null}
        </div>
      </div>
    </div>
  );
}

