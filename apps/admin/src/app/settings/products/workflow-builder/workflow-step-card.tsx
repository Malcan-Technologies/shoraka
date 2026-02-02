"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Bars3Icon, ChevronDownIcon, ChevronUpIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Card, CardContent } from "../../../../components/ui/card";
import { Button } from "../../../../components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../../../../components/ui/collapsible";
import type { WorkflowStepShape } from "../product-utils";

export interface WorkflowStepCardProps {
  step: WorkflowStepShape;
  isExpanded?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDelete?: () => void;
  children?: React.ReactNode;
}

/** Single workflow step as a draggable card with expand (config) and delete. Used inside SortableContext. */
export function WorkflowStepCard({
  step,
  isExpanded = false,
  onOpenChange,
  onDelete,
  children,
}: WorkflowStepCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-50 shadow-lg" : ""}
    >
      <Collapsible open={isExpanded} onOpenChange={onOpenChange}>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 py-3 pl-3 pr-2">
            <button
              type="button"
              className="touch-none cursor-grab rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring active:cursor-grabbing"
              aria-label={`Drag to reorder ${step.name}`}
              {...attributes}
              {...listeners}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <span className="flex-1 text-sm font-medium truncate">{step.name}</span>
            <span className="text-xs text-muted-foreground font-mono shrink-0">{step.id}</span>
            {onOpenChange && (
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  aria-label={isExpanded ? "Collapse config" : "Expand config"}
                >
                  {isExpanded ? (
                    <ChevronUpIcon className="h-4 w-4" />
                  ) : (
                    <ChevronDownIcon className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={onDelete}
                aria-label={`Delete ${step.name}`}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
          {children && (
            <CollapsibleContent>
              <div className="border-t px-3 pb-3 pt-2">{children}</div>
            </CollapsibleContent>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  );
}
