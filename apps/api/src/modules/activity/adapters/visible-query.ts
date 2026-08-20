const DEFAULT_BATCH_SIZE = 50;

export async function collectVisibleRecords<T>(
  fetchPage: (skip: number, take: number) => Promise<T[]>,
  isVisible: (record: T) => boolean | Promise<boolean>,
  options: { offset?: number; limit?: number } = {}
): Promise<T[]> {
  const offset = options.offset ?? 0;
  const targetCount = options.limit == null ? undefined : offset + options.limit;
  const batchSize = Math.max(options.limit ?? DEFAULT_BATCH_SIZE, DEFAULT_BATCH_SIZE);
  const visible: T[] = [];
  let skip = 0;

  while (targetCount == null || visible.length < targetCount) {
    const records = await fetchPage(skip, batchSize);
    if (records.length === 0) break;

    for (const record of records) {
      if (await isVisible(record)) {
        visible.push(record);
      }
    }

    if (records.length < batchSize) break;
    skip += records.length;
  }

  if (options.limit == null) {
    return visible.slice(offset);
  }
  return visible.slice(offset, offset + options.limit);
}
