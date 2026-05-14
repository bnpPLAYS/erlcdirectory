/**
 * Some deployments lag migrations; PostgREST errors when a column is absent from the schema cache.
 */
export function isMissingPostsColumnError(message: string | undefined, column: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  const c = column.toLowerCase();
  return m.includes(c) && (m.includes('schema cache') || m.includes('could not find'));
}
