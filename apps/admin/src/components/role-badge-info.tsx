import { Badge } from "@/components/ui/badge";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
        <button
          className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border ${role.bgColor} ${role.borderColor} ${role.color} hover:shadow-md transition-shadow cursor-help`}
        >
          <Icon className="h-5 w-5" />
          <span className="font-semibold text-sm">{role.name}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 rounded-2xl shadow-lg" side="bottom">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${role.bgColor}`}>
              <Icon className={`h-5 w-5 ${role.color}`} />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">{role.name}</h4>
              <p className="text-[13px] leading-6 text-muted-foreground">
                {role.description}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              Key Permissions
            </p>
            <ul className="space-y-1.5">
              {role.permissions.map((permission, index) => (
                <li key={index} className="flex items-start gap-2 text-[13px]">
                  <CheckIcon className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>{permission}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

