import { and, asc, eq, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import type { CommentView } from '$lib/comments';

const { chapters, comments, users } = schema;

const view = {
	id: comments.id,
	parentId: comments.parentId,
	panelId: comments.panelId,
	body: comments.body,
	createdAt: comments.createdAt,
	resolvedAt: comments.resolvedAt,
	author: sql<string | null>`nullif(coalesce(nullif(${users.name}, ''), ${users.email}, ''), '')`,
	authorId: comments.authorId
};

function listWhere(where: ReturnType<typeof and>): CommentView[] {
	return db
		.select(view)
		.from(comments)
		.leftJoin(users, eq(users.id, comments.authorId))
		.where(where)
		.orderBy(asc(comments.createdAt))
		.all();
}

/** Every comment on an element's panels, oldest first, with its author's display name. */
export function listComments(worldId: string, elementId: string) {
	return listWhere(and(eq(comments.worldId, worldId), eq(comments.elementId, elementId)));
}

/** Every comment on a chapter, oldest first. */
export function listChapterComments(worldId: string, chapterId: string) {
	return listWhere(and(eq(comments.worldId, worldId), eq(comments.chapterId, chapterId)));
}

/** Comments on every chapter of a manuscript in one query, grouped by chapter id. */
export function commentsByChapter(worldId: string, manuscriptId: string) {
	const rows = db
		.select({ ...view, chapterId: comments.chapterId })
		.from(comments)
		.leftJoin(users, eq(users.id, comments.authorId))
		.where(
			and(
				eq(comments.worldId, worldId),
				inArray(
					comments.chapterId,
					db
						.select({ id: chapters.id })
						.from(chapters)
						.where(eq(chapters.manuscriptId, manuscriptId))
				)
			)
		)
		.orderBy(asc(comments.createdAt))
		.all();
	const out = new Map<string, CommentView[]>();
	for (const { chapterId, ...c } of rows) out.set(chapterId!, [...(out.get(chapterId!) ?? []), c]);
	return out;
}

/** Open (unresolved) thread counts per element or per chapter, for list and binder badges. */
export function openThreads(worldId: string, by: 'element' | 'chapter'): Record<string, number> {
	const target = by === 'element' ? comments.elementId : comments.chapterId;
	const rows = db
		.select({ id: target, n: sql<number>`count(*)` })
		.from(comments)
		.where(
			and(
				eq(comments.worldId, worldId),
				isNotNull(target),
				isNull(comments.parentId),
				isNull(comments.resolvedAt)
			)
		)
		.groupBy(target)
		.all();
	return Object.fromEntries(rows.map((r) => [r.id!, r.n]));
}

type Target = { elementId: string; panelId: string } | { chapterId: string };

/**
 * Add a comment. With `parentId` it is a reply: it joins that comment's thread — always under the
 * thread's first comment, so threads stay one level deep — and takes the thread's target. Returns
 * null when the parent is not in this world or is on a different element or chapter.
 */
export function addComment(
	input: {
		worldId: string;
		body: string;
		authorId: string | null;
		parentId?: string | null;
	} & Target
) {
	const { worldId, body, authorId } = input;
	if (input.parentId) {
		const parent = db
			.select()
			.from(comments)
			.where(and(eq(comments.worldId, worldId), eq(comments.id, input.parentId)))
			.get();
		const sameTarget =
			'chapterId' in input
				? parent?.chapterId === input.chapterId
				: parent?.elementId === input.elementId;
		if (!parent || !sameTarget) return null;
		return db
			.insert(comments)
			.values({
				worldId,
				elementId: parent.elementId,
				chapterId: parent.chapterId,
				panelId: parent.panelId,
				parentId: parent.parentId ?? parent.id,
				body,
				authorId
			})
			.returning()
			.get();
	}
	const target =
		'chapterId' in input
			? { chapterId: input.chapterId }
			: { elementId: input.elementId, panelId: input.panelId };
	return db
		.insert(comments)
		.values({ worldId, ...target, body, authorId })
		.returning()
		.get();
}

/** Resolve or reopen a thread. Only a thread's first comment carries the state. */
export function setCommentResolved(worldId: string, id: string, resolved: boolean) {
	db.update(comments)
		.set({ resolvedAt: resolved ? new Date() : null })
		.where(and(eq(comments.worldId, worldId), eq(comments.id, id), isNull(comments.parentId)))
		.run();
}

/**
 * Delete a comment. Deleting a thread's first comment deletes its replies (foreign key cascade).
 * With `onlyAuthor` — a viewer deleting — only that author's own comment goes, and only while no
 * one has replied to it, so a viewer can never take other people's replies down with it.
 */
export function deleteComment(worldId: string, id: string, onlyAuthor?: string) {
	db.delete(comments)
		.where(
			and(
				eq(comments.worldId, worldId),
				eq(comments.id, id),
				onlyAuthor === undefined
					? undefined
					: and(
							eq(comments.authorId, onlyAuthor),
							sql`not exists (select 1 from comments r where r.parent_id = ${comments.id})`
						)
			)
		)
		.run();
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
