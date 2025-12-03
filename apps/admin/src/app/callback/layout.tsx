import { ReactNode } from "react";

// Separate layout for callback page - no auth guard needed
// The callback page handles its own redirect logic
export default function CallbackLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

