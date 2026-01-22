import activityEvents from "./activity-events.json";

export interface EventConfig {
  label: string;
  dotColor: string;
}

/**
 * Centralized configuration for all activity events.
 * Maps raw event types to human-readable labels and UI colors.
 */
export const ACTIVITY_EVENT_CONFIG: Record<string, EventConfig> = activityEvents;

/**
 * Fallback for unknown event types
 */
export function getEventConfig(eventType: string): EventConfig {
  return (
    ACTIVITY_EVENT_CONFIG[eventType] || {
      label: eventType
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      dotColor: "bg-gray-400",
    }
  );
}
