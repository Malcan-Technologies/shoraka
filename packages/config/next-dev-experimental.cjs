/** Shared Next.js experimental flags for local `next dev` across portals. */
exports.NEXT_DEV_EXPERIMENTAL = {
  optimizePackageImports: ["@cashsouk/ui", "@cashsouk/config"],
  // Persistent Turbopack cache grows without bound here and pegs CPU on startup.
  turbopackFileSystemCacheForDev: false,
  // Four portals run in parallel; do not compile every route at boot.
  preloadEntriesOnStart: false,
};
