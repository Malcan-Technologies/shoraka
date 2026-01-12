export const DATE_RANGES: { value: string; label: string }[] = [
  { value: "all", label: "All Time" },
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
];

export type DateRangeValue = "all" | "24h" | "7d" | "30d";
