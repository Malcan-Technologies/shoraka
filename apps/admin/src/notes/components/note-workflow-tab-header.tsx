import { CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type NoteWorkflowTabHeaderProps = {
  title: string;
  description: string;
  asCardHeader?: boolean;
  className?: string;
};

export function NoteWorkflowTabHeader({
  title,
  description,
  asCardHeader = false,
  className,
}: NoteWorkflowTabHeaderProps) {
  const body = (
    <>
      {asCardHeader ? (
        <CardTitle className="text-base">{title}</CardTitle>
      ) : (
        <h2 className="text-base font-semibold">{title}</h2>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </>
  );

  if (asCardHeader) {
    return <CardHeader className={cn("pb-3", className)}>{body}</CardHeader>;
  }

  return <div className={cn("space-y-1", className)}>{body}</div>;
}
