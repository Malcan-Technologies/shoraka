import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { CheckIcon } from "@heroicons/react/24/outline";

interface RoleBadgeInfoProps {
  role: {
    name: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    borderColor: string;
    description: string;
    permissions: string[];
  };
}

export function RoleBadgeInfo({ role }: RoleBadgeInfoProps) {
  const Icon = role.icon;

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background text-foreground hover:bg-muted/50 transition-colors cursor-help text-xs font-medium">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{role.name}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72" side="bottom">
        <div className="space-y-2.5">
          <div>
            <h4 className="font-semibold text-sm mb-1.5">{role.name}</h4>
            <p className="text-xs leading-relaxed text-muted-foreground">{role.description}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Key Permissions</p>
            <ul className="space-y-1">
              {role.permissions.map((permission, index) => (
                <li key={index} className="flex items-start gap-1.5 text-xs">
                  <CheckIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{permission}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
