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
    <div className="space-y-5 pt-4">
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">
          Configure declarations
        </p>
        <p className="text-xs text-muted-foreground">
          Borrowers must agree to these declarations before submitting
        </p>
      </div>

      {/* Declarations List */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Declarations ({declarations.length})</Label>
        {declarations.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {declarations.map((declaration, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-3 rounded-lg border bg-background group"
              >
                <span className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {index + 1}.
                </span>
                <p className="flex-1 text-xs leading-relaxed">{declaration}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDeclaration(index)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                >
                  <TrashIcon className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <p className="text-xs text-muted-foreground">
              No declarations yet. Add your first declaration below.
            </p>
          </div>
        )}
      </div>

      {/* Add New Declaration */}
      <div className="space-y-2">
        <Label htmlFor="newDeclaration" className="text-sm font-medium">
          Add New Declaration
        </Label>
        <div className="flex gap-2">
          <Textarea
            id="newDeclaration"
            placeholder="Type declaration statement (e.g., 'The invoice submitted is genuine and valid...')"
            value={newDeclaration}
            onChange={(e) => setNewDeclaration(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                addDeclaration();
              }
            }}
            className="min-h-[80px] text-sm"
          />
          <Button
            type="button"
            onClick={addDeclaration}
            size="sm"
            disabled={!newDeclaration.trim()}
            className="self-end"
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Add declaration statements that borrowers must agree to before submitting. Press Ctrl+Enter (or Cmd+Enter) to add.
        </p>
      </div>

      <div className="pt-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded">
        {declarations.length} declaration(s) configured
      </div>
    </div>
  );
}

