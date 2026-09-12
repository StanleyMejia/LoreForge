import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { prunable, revisionDue, type RevisionKind } from '$lib/revisions';

const { revisions, users } = schema;

interface RevisionInput {
	worldId: string;
	kind: RevisionKind;
	docId: string;
	title: string;
	content: string;
	authorId: string | null;
	label?: string;
}

export function saveRevision(input: RevisionInput) {
	db.insert(revisions)
		.values({ ...input, label: input.label ?? '' })
		.run();
}

/** Record the pre-image if the newest revision is older than the window, then prune. */
export function maybeRevision(input: Omit<RevisionInput, 'label'>) {
	const newest = db
		.select({ createdAt: revisions.createdAt })
		.from(revisions)
		.where(and(eq(revisions.kind, input.kind), eq(revisions.docId, input.docId)))
		.orderBy(desc(revisions.createdAt))
		.limit(1)
		.get();
	if (!revisionDue(newest?.createdAt.getTime())) return;
	saveRevision(input);
	const rows = db
		.select({ id: revisions.id, label: revisions.label })
		.from(revisions)
		.where(and(eq(revisions.kind, input.kind), eq(revisions.docId, input.docId)))
		.orderBy(desc(revisions.createdAt))
		.all();
	const stale = prunable(rows);
	if (stale.length) db.delete(revisions).where(inArray(revisions.id, stale)).run();
}

/** Newest first. Reads `length(content)` rather than the blob itself. */
export function listRevisions(worldId: string, kind: RevisionKind, docId: string) {
	return db
		.select({
			id: revisions.id,
			title: revisions.title,
			label: revisions.label,
			bytes: sql<number>`length(${revisions.content})`,
			createdAt: revisions.createdAt,
			author: sql<
				string | null
			>`nullif(coalesce(nullif(${users.name}, ''), ${users.email}, ''), '')`
		})
		.from(revisions)
		.leftJoin(users, eq(users.id, revisions.authorId))
		.where(
			and(eq(revisions.worldId, worldId), eq(revisions.kind, kind), eq(revisions.docId, docId))
		)
		.orderBy(desc(revisions.createdAt))
		.all();
}

export function getRevision(worldId: string, id: string) {
	return db
		.select()
		.from(revisions)
		.where(and(eq(revisions.worldId, worldId), eq(revisions.id, id)))
		.get();
}

export function deleteRevisions(kind: RevisionKind, docId: string) {
	db.delete(revisions)
		.where(and(eq(revisions.kind, kind), eq(revisions.docId, docId)))
		.run();
}
