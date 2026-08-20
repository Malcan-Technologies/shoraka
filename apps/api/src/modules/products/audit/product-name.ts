export function productNameFromWorkflow(workflow: unknown): string {
  if (!Array.isArray(workflow) || workflow.length === 0) return "";
  const first = workflow[0] as { config?: { name?: string; type?: { name?: string } } } | undefined;
  const name = first?.config?.name?.trim() ?? first?.config?.type?.name?.trim();
  return name ?? "";
}
