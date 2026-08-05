"use client";

import * as React from "react";
import { useHeader } from "@cashsouk/ui";

/** Sets the global admin header title for server-rendered pages. */
export function SetHeaderTitle({ title }: { title: string }) {
  const { setTitle } = useHeader();
  React.useEffect(() => {
    setTitle(title);
    return () => setTitle("");
  }, [setTitle, title]);
  return null;
}
