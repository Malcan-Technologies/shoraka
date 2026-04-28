"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { MermaidConfig } from "mermaid";

import { cn } from "../lib/utils";

type MermaidDiagramProps = {
  chart: string;
  className?: string;
};

function hslFromCssValue(value: string, fallback: string) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith("#") || trimmed.startsWith("rgb") || trimmed.startsWith("hsl")) return trimmed;
  return `hsl(${trimmed})`;
}

function getThemeVariables(element: HTMLElement): MermaidConfig["themeVariables"] {
  const styles = window.getComputedStyle(element);

  return {
    background: hslFromCssValue(styles.getPropertyValue("--card"), "#ffffff"),
    primaryColor: hslFromCssValue(styles.getPropertyValue("--muted"), "#f4f4f5"),
    primaryTextColor: hslFromCssValue(styles.getPropertyValue("--foreground"), "#18181b"),
    primaryBorderColor: hslFromCssValue(styles.getPropertyValue("--border"), "#e4e4e7"),
    lineColor: hslFromCssValue(styles.getPropertyValue("--primary"), "#8a0304"),
    secondaryColor: hslFromCssValue(styles.getPropertyValue("--secondary"), "#f4f4f5"),
    tertiaryColor: hslFromCssValue(styles.getPropertyValue("--accent"), "#f4f4f5"),
    fontFamily: styles.fontFamily,
  };
}

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const reactId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const renderId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

    async function renderDiagram() {
      const container = containerRef.current;
      if (!container) return;

      try {
        setError(null);
        const mermaid = (await import("mermaid")).default;

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: getThemeVariables(container),
        });

        const result = await mermaid.render(renderId, chart);
        if (!cancelled) {
          setSvg(result.svg);
        }
      } catch (renderError) {
        if (!cancelled) {
          setSvg("");
          setError(renderError instanceof Error ? renderError.message : "Unable to render diagram");
        }
      }
    }

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  return (
    <figure
      ref={containerRef}
      className={cn("mt-6 overflow-x-auto rounded-2xl border bg-card p-4", className)}
    >
      {error ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-destructive">Unable to render Mermaid diagram.</p>
          <pre className="overflow-x-auto rounded-xl bg-muted/60 p-4 text-xs leading-5 text-foreground">
            <code>{chart}</code>
          </pre>
        </div>
      ) : svg ? (
        <div
          className="[&>svg]:mx-auto [&>svg]:h-auto [&>svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          Loading diagram...
        </div>
      )}
    </figure>
  );
}
