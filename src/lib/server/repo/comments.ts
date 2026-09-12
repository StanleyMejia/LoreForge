import { and, asc, eq, isNull, notInArray, sql } from 'drizzle-orm';
import { db, schema } from '../db';

const { comments, users } = schema;

/** Every comment on an element, oldest first, with its author's display name. */
export function listComments(worldId: string, elementId: string) {
	return db
		.select({
			id: comments.id,
			panelId: comments.panelId,
			body: comments.body,
			createdAt: comments.createdAt,
			resolvedAt: comments.resolvedAt,
			author: sql<
				string | null
			>`nullif(coalesce(nullif(${users.name}, ''), ${users.email}, ''), '')`
		})
		.from(comments)
		.leftJoin(users, eq(users.id, comments.authorId))
		.where(and(eq(comments.worldId, worldId), eq(comments.elementId, elementId)))
		.orderBy(asc(comments.createdAt))
		.all();
}

export function addComment(input: {
	worldId: string;
	elementId: string;
	panelId: string;
	body: string;
	authorId: string | null;
}) {
	return db.insert(comments).values(input).returning().get();
}

export function setCommentResolved(worldId: string, id: string, resolved: boolean) {
	db.update(comments)
		.set({ resolvedAt: resolved ? new Date() : null })
		.where(and(eq(comments.worldId, worldId), eq(comments.id, id)))
		.run();
}

export function deleteComment(worldId: string, id: string) {
	db.delete(comments)
		.where(and(eq(comments.worldId, worldId), eq(comments.id, id)))
		.run();
}

/** Unresolved comment counts per element, for list badges. */
export function openCommentCounts(worldId: string): Map<string, number> {
	const rows = db
		.select({ elementId: comments.elementId, n: sql<number>`count(*)` })
		.from(comments)
		.where(and(eq(comments.worldId, worldId), isNull(comments.resolvedAt)))
		.groupBy(comments.elementId)
		.all();
	return new Map(rows.map((r) => [r.elementId, r.n]));
}

/**
 * Drop comments whose panel no longer exists. Called on element save, like the other derived
 * cleanups: panel ids live in JSON, so nothing else would ever remove them.
 */
export function pruneComments(elementId: string, panelIds: string[]) {
	db.delete(comments)
		.where(
			panelIds.length
				? and(eq(comments.elementId, elementId), notInArray(comments.panelId, panelIds))
				: eq(comments.elementId, elementId)
		)
		.run();
}
