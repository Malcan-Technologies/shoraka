import type { UserRole } from "@cashsouk/types";
import { PortalBadge } from "@cashsouk/ui";
import { cn } from "@/lib/utils";

function AdminRoleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-transparent bg-violet-100 px-2.5 py-0.5 text-ui font-normal text-violet-800 dark:bg-violet-950/40 dark:text-violet-200",
        className
      )}
    >
      Admin
    </span>
  );
}

export function UserRoleBadges({
  roles,
  className,
}: {
  roles: UserRole[];
  className?: string;
}) {
  if (roles.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {roles.map((role) => {
        if (role === "INVESTOR") {
          return <PortalBadge key={role} portal="investor" />;
        }
        if (role === "ISSUER") {
          return <PortalBadge key={role} portal="issuer" />;
        }
        return <AdminRoleBadge key={role} />;
      })}
    </span>
  );
}
