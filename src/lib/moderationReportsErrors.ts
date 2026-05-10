/** PostgREST / Postgres errors when `moderation_reports` has not been migrated yet. */
export function isModerationReportsSchemaMissingError(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    (m.includes('moderation_reports') || m.includes('schema cache')) &&
    (m.includes('could not find') || m.includes('does not exist') || m.includes('relation'))
  );
}
