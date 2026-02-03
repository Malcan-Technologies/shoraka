"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bars3Icon, ChevronDownIcon, ChevronUpIcon, EllipsisVerticalIcon, LockClosedIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Card, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../../components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu";
import type { WorkflowStepShape } from "../product-utils";

export interface WorkflowStepCardProps {
  step: WorkflowStepShape;
  isExpanded?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDelete?: () => void;
  /** Called when pointer goes down on the drag handle so parent can collapse this card before drag starts. */
  onDragHandlePointerDown?: () => void;
  /** First or last step: not draggable, no delete, show lock icon. */
  isLocked?: boolean;
  /** Briefly show "just added" highlight and New badge (cleared by parent after a few seconds). */
  isJustAdded?: boolean;
  /** Show "Edited" when the step has unsaved changes (edit mode only). */
  isEdited?: boolean;
  children?: React.ReactNode;
}

/** Single workflow step as a draggable card with expand (config) and delete. Used inside SortableContext. */
export function WorkflowStepCard({
  step,
  isExpanded = false,
  onOpenChange,
  onDelete,
  onDragHandlePointerDown,
  isLocked = false,
  isJustAdded = false,
  isEdited = false,
  children,
}: WorkflowStepCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, disabled: isLocked });

  const listenerHandlers = (listeners ?? {}) as { onPointerDown?: (e: React.PointerEvent) => void };
  const { onPointerDown: listenerPointerDown, ...restListeners } = listenerHandlers;

  const style: React.CSSProperties = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`overflow-hidden shrink-0 transition-colors duration-500 ${isJustAdded ? "bg-muted/50" : ""} ${isDragging ? "opacity-60 shadow-xl z-50 scale-[1.02]" : ""}`}
    >
      <Collapsible open={isExpanded} onOpenChange={onOpenChange}>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 h-11 px-4 box-border shrink-0">
            {isLocked ? (
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-muted-foreground"
                title="Locked – first and last steps cannot be reordered or removed"
                aria-label="Locked step"
              >
                <LockClosedIcon className="h-5 w-5 shrink-0" />
              </span>
            ) : (
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center touch-none cursor-grab rounded text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:cursor-grabbing"
                aria-label={`Drag to reorder ${step.name}`}
                {...attributes}
                {...restListeners}
                onPointerDown={(e) => {
                  onDragHandlePointerDown?.();
                  listenerPointerDown?.(e);
                }}
              >
                <Bars3Icon className="h-5 w-5 shrink-0" />
              </button>
            )}
            {onOpenChange ? (
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex flex-1 min-w-0 items-center gap-2 cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:rounded"
                  aria-label={isExpanded ? "Collapse config" : "Expand config"}
                >
                  <span className="flex-1 min-w-0 text-sm font-medium truncate">{step.name}</span>
                  {isJustAdded ? (
                    <span className="shrink-0 text-sm text-muted-foreground">Just added</span>
                  ) : isEdited ? (
                    <span className="shrink-0 text-sm text-muted-foreground">Edited</span>
                  ) : null}
                </button>
              </CollapsibleTrigger>
            ) : (
              <>
                <span className="flex-1 min-w-0 text-sm font-medium truncate">{step.name}</span>
                {isJustAdded ? (
                  <span className="shrink-0 text-sm text-muted-foreground">Just added</span>
                ) : isEdited ? (
                  <span className="shrink-0 text-sm text-muted-foreground">Edited</span>
                ) : null}
              </>
            )}
            {onOpenChange ? (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0 focus-visible:ring-inset"
                  aria-label={isExpanded ? "Collapse config" : "Expand config"}
                >
                  {isExpanded ? (
                    <ChevronUpIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
            ) : (
              <span className="h-8 w-8 shrink-0" aria-hidden />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-foreground focus-visible:ring-inset"
                  aria-label="Step options"
                >
                  <EllipsisVerticalIcon className="h-4 w-4 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isLocked ? (
                  <DropdownMenuItem disabled className="cursor-default opacity-100">
                    <LockClosedIcon className="h-4 w-4 shrink-0" />
                    Locked
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  >
                    <TrashIcon className="h-4 w-4 shrink-0" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {children && (
            <CollapsibleContent>
              <div className="border-t border-border px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3">{children}</div>
            </CollapsibleContent>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  );
}
