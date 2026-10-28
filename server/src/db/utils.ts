const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Postgres rejects malformed uuids with an error, so check before querying.
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

// Postgres unique_violation
export function isUniqueViolation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505';
}

// Builds a PostgREST `or=` filter that ILIKE-matches `term` against each column.
// The term is escaped twice: once so %, _ and \ match literally in LIKE, and once
// for the double-quoted PostgREST value so commas/parentheses can't alter the filter.
export function ilikeAny(columns: string[], term: string): string {
  const likeEscaped = term.replace(/[\\%_]/g, '\\$&');
  const quoted = `"%${likeEscaped.replace(/[\\"]/g, '\\$&')}%"`;
  return columns.map((column) => `${column}.ilike.${quoted}`).join(',');
}
