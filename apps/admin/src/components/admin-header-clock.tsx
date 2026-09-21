"use client";

import { useEffect, useState } from "react";
import { formatAdminHeaderClock } from "./admin-header-clock-format";

/** Live Malaysia date and time in the admin chrome. */
export function AdminHeaderClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) {
    return <div className="hidden h-5 w-56 sm:block" aria-hidden />;
  }

  const { dateLabel, timeLabel } = formatAdminHeaderClock(now);
  const label = `${dateLabel}, ${timeLabel}`;

  return (
    <time
      dateTime={now.toISOString()}
      aria-label={`${label} Malaysia time`}
      title={label}
      className="hidden whitespace-nowrap text-ui tabular-nums text-muted-foreground sm:inline"
    >
      {label}
    </time>
  );
}
