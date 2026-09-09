import { and, asc, count, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { countWords } from '$lib/slug';
import { syncLinks } from './elements';
import { touchWorld } from './worlds';
import { CHAPTER_STATUSES, type ChapterStatus } from '$lib/types';

const { manuscripts, chapters, links } = schema;

export function listManuscripts(worldId: string) {
	return db
		.select({
			id: manuscripts.id,
			title: manuscripts.title,
			description: manuscripts.description,
			updatedAt: manuscripts.updatedAt,
			chapterCount: count(chapters.id),
			wordCount: sql<number>`coalesce(sum(${chapters.wordCount}), 0)`.mapWith(Number)
		})
		.from(manuscripts)
		.leftJoin(chapters, eq(chapters.manuscriptId, manuscripts.id))
		.where(eq(manuscripts.worldId, worldId))
		.groupBy(manuscripts.id)
		.orderBy(asc(manuscripts.sortOrder), asc(manuscripts.createdAt))
		.all();
}

export function getManuscript(worldId: string, id: string) {
	return db
		.select()
		.from(manuscripts)
		.where(and(eq(manuscripts.worldId, worldId), eq(manuscripts.id, id)))
		.get();
}

export function createManuscript(worldId: string, title: string, description = '') {
	touchWorld(worldId);
	return db
		.insert(manuscripts)
		.values({ worldId, title: title.trim(), description })
		.returning()
		.get();
}

export function updateManuscript(id: string, patch: { title?: string; description?: string }) {
	return db
		.update(manuscripts)
		.set({ ...patch, updatedAt: new Date() })
		.where(eq(manuscripts.id, id))
		.returning()
		.get();
}

export function deleteManuscript(id: string) {
	const ids = db
		.select({ id: chapters.id })
		.from(chapters)
		.where(eq(chapters.manuscriptId, id))
		.all()
		.map((c) => c.id);
	for (const cid of ids)
		db.delete(links)
			.where(and(eq(links.sourceKind, 'chapter'), eq(links.sourceId, cid)))
			.run();
	db.delete(manuscripts).where(eq(manuscripts.id, id)).run();
}

// ---- chapters ------------------------------------------------------------

export function listChapters(manuscriptId: string) {
	return db
		.select({
			id: chapters.id,
			title: chapters.title,
			synopsis: chapters.synopsis,
			status: chapters.status,
			wordCount: chapters.wordCount,
			sortOrder: chapters.sortOrder,
			updatedAt: chapters.updatedAt
		})
		.from(chapters)
		.where(eq(chapters.manuscriptId, manuscriptId))
		.orderBy(asc(chapters.sortOrder), asc(chapters.createdAt))
		.all();
}

export function getChapter(manuscriptId: string, id: string) {
	return db
		.select()
		.from(chapters)
		.where(and(eq(chapters.manuscriptId, manuscriptId), eq(chapters.id, id)))
		.get();
}

export function createChapter(manuscriptId: string, title: string) {
	const max =
		db
			.select({ m: sql<number>`coalesce(max(${chapters.sortOrder}), -1)` })
			.from(chapters)
			.where(eq(chapters.manuscriptId, manuscriptId))
			.get()?.m ?? -1;
	const row = db
		.insert(chapters)
		.values({ manuscriptId, title: title.trim(), sortOrder: max + 1 })
		.returning()
		.get();
	db.update(manuscripts)
		.set({ updatedAt: new Date() })
		.where(eq(manuscripts.id, manuscriptId))
		.run();
	return row;
}

export interface ChapterInput {
	title: string;
	synopsis?: string;
	body?: string;
	status?: string;
}

export function updateChapter(
	worldId: string,
	manuscriptId: string,
	id: string,
	input: ChapterInput
) {
	const status: ChapterStatus = (CHAPTER_STATUSES as readonly string[]).includes(input.status ?? '')
		? (input.status as ChapterStatus)
		: 'draft';
	const body = input.body ?? '';
	const row = db
		.update(chapters)
		.set({
			title: input.title.trim(),
			synopsis: input.synopsis ?? '',
			body,
			status,
			wordCount: countWords(body),
			updatedAt: new Date()
		})
		.where(and(eq(chapters.manuscriptId, manuscriptId), eq(chapters.id, id)))
		.returning()
		.get();
	if (row) syncLinks(worldId, 'chapter', row.id, row.body);
	db.update(manuscripts)
		.set({ updatedAt: new Date() })
		.where(eq(manuscripts.id, manuscriptId))
		.run();
	touchWorld(worldId);
	return row;
}

export function deleteChapter(manuscriptId: string, id: string) {
	db.delete(links)
		.where(and(eq(links.sourceKind, 'chapter'), eq(links.sourceId, id)))
		.run();
	db.delete(chapters)
		.where(and(eq(chapters.manuscriptId, manuscriptId), eq(chapters.id, id)))
		.run();
}

/** Move a chapter one step up or down, renumbering the whole manuscript densely. */
export function moveChapter(manuscriptId: string, id: string, dir: 'up' | 'down') {
	const list = listChapters(manuscriptId);
	const i = list.findIndex((c) => c.id === id);
	if (i < 0) return;
	const j = dir === 'up' ? i - 1 : i + 1;
	if (j < 0 || j >= list.length) return;
	[list[i], list[j]] = [list[j], list[i]];
	db.transaction((tx) => {
		list.forEach((c, idx) => {
			tx.update(chapters).set({ sortOrder: idx }).where(eq(chapters.id, c.id)).run();
		});
	});
}

/** Adjacent chapters for prev/next navigation in the editor. */
export function chapterNeighbours(manuscriptId: string, id: string) {
	const list = listChapters(manuscriptId);
	const i = list.findIndex((c) => c.id === id);
	return {
		prev: i > 0 ? list[i - 1] : null,
		next: i >= 0 && i < list.length - 1 ? list[i + 1] : null,
		index: i,
		total: list.length
	};
}
