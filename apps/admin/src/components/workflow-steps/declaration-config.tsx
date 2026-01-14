"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

interface DeclarationConfig {
  declarations?: string[];
  requireAll?: boolean;
}

interface DeclarationConfigProps {
  config: DeclarationConfig;
  onChange: (config: DeclarationConfig) => void;
}

export function DeclarationConfig({ config, onChange }: DeclarationConfigProps) {
  const declarations = config.declarations || [];

  const [newDeclaration, setNewDeclaration] = React.useState("");

  const addDeclaration = () => {
    if (newDeclaration.trim()) {
      onChange({
        ...config,
        declarations: [...declarations, newDeclaration.trim()],
      });
      setNewDeclaration("");
    }
  };

  const removeDeclaration = (index: number) => {
    onChange({
      ...config,
      declarations: declarations.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="p-3 sm:p-5 rounded-lg border bg-card">
      <div className="mb-4 sm:mb-5">
        <Label className="text-sm sm:text-base font-semibold">
          Add Declaration
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Borrowers must agree to these declarations before submitting
        </p>
      </div>
      
      <div className="space-y-4 sm:space-y-5">
        {/* Declarations List */}
        {declarations.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Declarations ({declarations.length})</Label>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-2">
              {declarations.map((declaration, index) => {
                const isMultiLine = declaration.includes('\n') || declaration.length > 60;
                return (
                  <div
                    key={index}
                    className={`flex gap-3 group p-2 rounded-md border border-transparent hover:border-destructive transition-all ${isMultiLine ? 'items-start' : 'items-center'}`}
                  >
                    <span className="text-sm text-foreground font-medium w-2 shrink-0">
                      {index + 1}.
                    </span>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line flex-1 min-w-0 break-words">{declaration}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDeclaration(index)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 p-0 shrink-0"
                    >
                      <TrashIcon className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add New Declaration */}
        <div className="space-y-2 pt-3 border-t">
          <Label htmlFor="newDeclaration" className="text-sm font-medium">
            Add New Declaration
          </Label>
          <Textarea
            id="newDeclaration"
            placeholder="Type declaration statement (e.g., 'The invoice submitted is genuine and valid...')"
            value={newDeclaration}
            onChange={(e) => setNewDeclaration(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (newDeclaration.trim()) {
                  addDeclaration();
                }
              }
            }}
            className="min-h-[100px] text-sm"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Press Enter to add, Shift+Enter for new line
            </p>
            <Button
              type="button"
              onClick={addDeclaration}
              disabled={!newDeclaration.trim()}
              className="h-9"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

