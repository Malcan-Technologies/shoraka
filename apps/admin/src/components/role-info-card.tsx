import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckIcon } from "@heroicons/react/24/outline";

interface RoleInfoCardProps {
  title: string;
  description: string;
  permissions: string[];
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
}

export function RoleInfoCard({
  title,
  description,
  permissions,
  icon: Icon,
  iconColor = "text-primary",
}: RoleInfoCardProps) {
  return (
    <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader>
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl bg-muted ${iconColor}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-xl font-semibold mb-2">{title}</CardTitle>
            <CardDescription className="text-[15px] leading-7">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-muted-foreground mb-3">Key Permissions</h4>
          <ul className="space-y-2">
            {permissions.map((permission, index) => (
              <li key={index} className="flex items-start gap-2 text-[15px]">
                <CheckIcon className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{permission}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
