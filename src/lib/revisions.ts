// ponytail: history reaches back 50 windows of *editing time* (about 8 h/doc), not wall time.
// Upgrade path: thin rows older than a week into day buckets inside prunable().
export const REVISION_WINDOW_MS = 600_000;
// ponytail: per-document cap only, no per-world quota. Upgrade path: pass a world total to
// prunable(), or add a "clear history" action to world settings.
export const MAX_REVISIONS = 50;

export type RevisionKind = 'chapter' | 'element';

/**
 * True when the newest revision is old enough that the next save should record a new one.
 * Consecutive saves inside one window share the revision taken at the start of it.
 */
export function revisionDue(
	newestMs: number | undefined,
	now = Date.now(),
	windowMs = REVISION_WINDOW_MS
): boolean {
	return newestMs === undefined || now - newestMs >= windowMs;
}

/**
 * Ids to delete, given rows newest first: unpinned rows past the newest `keep`.
 * Pinned rows (a non-empty label) are never pruned and never count against the budget.
 */
export function prunable(rows: { id: string; label: string }[], keep = MAX_REVISIONS): string[] {
	const stale: string[] = [];
	let kept = 0;
	for (const r of rows) {
		if (r.label) continue;
		if (++kept > keep) stale.push(r.id);
	}
	return stale;
}
