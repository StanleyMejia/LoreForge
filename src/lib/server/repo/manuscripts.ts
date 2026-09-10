import { and, asc, count, eq, inArray, or, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { countWords } from '$lib/slug';
import { syncLinks } from './elements';
import { touchWorld } from './worlds';
import { indexChapter, removeFromIndex } from './search';
import { CHAPTER_ROLES, CHAPTER_STATUSES, type ChapterRole, type ChapterStatus } from '$lib/types';

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
	for (const cid of ids) {
		db.delete(links)
			.where(and(eq(links.sourceKind, 'chapter'), eq(links.sourceId, cid)))
			.run();
		removeFromIndex('chapter', cid);
	}
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
	eventId?: string | null;
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
			eventId: input.eventId ?? null,
			updatedAt: new Date()
		})
		.where(and(eq(chapters.manuscriptId, manuscriptId), eq(chapters.id, id)))
		.returning()
		.get();
	if (row) {
		syncLinks(worldId, 'chapter', row.id, row.body);
		indexChapter(worldId, row);
	}
	db.update(manuscripts)
		.set({ updatedAt: new Date() })
		.where(eq(manuscripts.id, manuscriptId))
		.run();
	touchWorld(worldId);
	return row;
}

export function deleteChapter(manuscriptId: string, id: string) {
	removeFromIndex('chapter', id);
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

// ---- cross references ----------------------------------------------------

const { chapterRefs, elements, elementTypes } = schema;

export interface RefInput {
	elementId: string;
	role: ChapterRole;
	note?: string;
}

/** Replace all structured references of a chapter. Unknown roles and foreign elements are dropped. */
export function setChapterRefs(worldId: string, chapterId: string, refs: RefInput[]) {
	const valid = new Set(
		db
			.select({ id: elements.id })
			.from(elements)
			.where(eq(elements.worldId, worldId))
			.all()
			.map((e) => e.id)
	);
	const seen = new Set<string>();
	const rows = refs
		.filter((r) => valid.has(r.elementId) && (CHAPTER_ROLES as readonly string[]).includes(r.role))
		.filter((r) => {
			const k = `${r.elementId}:${r.role}`;
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		})
		.map((r, i) => ({
			chapterId,
			elementId: r.elementId,
			role: r.role,
			note: r.note ?? '',
			sortOrder: i
		}));
	db.transaction((tx) => {
		tx.delete(chapterRefs).where(eq(chapterRefs.chapterId, chapterId)).run();
		if (rows.length) tx.insert(chapterRefs).values(rows).run();
	});
}

export interface ChapterRefView {
	elementId: string;
	role: ChapterRole;
	note: string;
	name: string;
	slug: string;
	icon: string;
	typeName: string;
	summary: string;
}

export function chapterRefsFor(chapterId: string): ChapterRefView[] {
	return db
		.select({
			elementId: chapterRefs.elementId,
			role: chapterRefs.role,
			note: chapterRefs.note,
			name: elements.name,
			slug: elements.slug,
			icon: elementTypes.icon,
			typeName: elementTypes.singular,
			summary: elements.summary
		})
		.from(chapterRefs)
		.innerJoin(elements, eq(elements.id, chapterRefs.elementId))
		.innerJoin(elementTypes, eq(elementTypes.id, elements.typeId))
		.where(eq(chapterRefs.chapterId, chapterId))
		.orderBy(asc(chapterRefs.sortOrder))
		.all()
		.map((r) => ({ ...r, role: r.role as ChapterRole }));
}

/** Refs for every chapter of a manuscript, keyed by chapter id (for the overview table). */
export function refsByChapter(manuscriptId: string): Map<string, ChapterRefView[]> {
	const rows = db
		.select({
			chapterId: chapterRefs.chapterId,
			elementId: chapterRefs.elementId,
			role: chapterRefs.role,
			note: chapterRefs.note,
			name: elements.name,
			slug: elements.slug,
			icon: elementTypes.icon,
			typeName: elementTypes.singular,
			summary: elements.summary
		})
		.from(chapterRefs)
		.innerJoin(chapters, eq(chapters.id, chapterRefs.chapterId))
		.innerJoin(elements, eq(elements.id, chapterRefs.elementId))
		.innerJoin(elementTypes, eq(elementTypes.id, elements.typeId))
		.where(eq(chapters.manuscriptId, manuscriptId))
		.orderBy(asc(chapterRefs.sortOrder))
		.all();
	const out = new Map<string, ChapterRefView[]>();
	for (const r of rows) {
		const list = out.get(r.chapterId) ?? [];
		list.push({ ...r, role: r.role as ChapterRole });
		out.set(r.chapterId, list);
	}
	return out;
}

export interface Appearance {
	manuscriptId: string;
	manuscriptTitle: string;
	chapterId: string;
	chapterTitle: string;
	chapterIndex: number;
	roles: (ChapterRole | 'mention')[];
}

/** Every chapter an element appears in (structured refs + text mentions), in reading order. */
export function appearances(elementId: string): Appearance[] {
	const byChapter = new Map<string, Set<ChapterRole | 'mention'>>();
	for (const r of db
		.select({ chapterId: chapterRefs.chapterId, role: chapterRefs.role })
		.from(chapterRefs)
		.where(eq(chapterRefs.elementId, elementId))
		.all()) {
		(byChapter.get(r.chapterId) ?? byChapter.set(r.chapterId, new Set()).get(r.chapterId)!).add(
			r.role as ChapterRole
		);
	}
	for (const l of db
		.select({ sourceId: links.sourceId })
		.from(links)
		.where(and(eq(links.targetId, elementId), eq(links.sourceKind, 'chapter')))
		.all()) {
		(byChapter.get(l.sourceId) ?? byChapter.set(l.sourceId, new Set()).get(l.sourceId)!).add(
			'mention'
		);
	}
	if (byChapter.size === 0) return [];
	const rows = db
		.select({
			chapterId: chapters.id,
			chapterTitle: chapters.title,
			chapterSort: chapters.sortOrder,
			manuscriptId: manuscripts.id,
			manuscriptTitle: manuscripts.title,
			manuscriptSort: manuscripts.sortOrder
		})
		.from(chapters)
		.innerJoin(manuscripts, eq(manuscripts.id, chapters.manuscriptId))
		.where(inArray(chapters.id, [...byChapter.keys()]))
		.orderBy(asc(manuscripts.sortOrder), asc(manuscripts.title), asc(chapters.sortOrder))
		.all();
	const order: ChapterRole[] = ['pov', 'location', 'cast'];
	return rows.map((r) => {
		const set = byChapter.get(r.chapterId)!;
		const roles: (ChapterRole | 'mention')[] = order.filter((x) => set.has(x));
		if (set.has('mention')) roles.push('mention');
		return {
			manuscriptId: r.manuscriptId,
			manuscriptTitle: r.manuscriptTitle,
			chapterId: r.chapterId,
			chapterTitle: r.chapterTitle,
			chapterIndex: r.chapterSort + 1,
			roles
		};
	});
}

export interface CastEntry {
	elementId: string;
	name: string;
	slug: string;
	icon: string;
	typeName: string;
	chapters: number;
	roles: (ChapterRole | 'mention')[];
}

/** Elements appearing across a manuscript, most frequent first. */
export function manuscriptCast(manuscriptId: string): CastEntry[] {
	const chapterIds = listChapters(manuscriptId).map((c) => c.id);
	if (chapterIds.length === 0) return [];
	const agg = new Map<string, { chapters: Set<string>; roles: Set<ChapterRole | 'mention'> }>();
	const bump = (elementId: string, chapterId: string, role: ChapterRole | 'mention') => {
		const a = agg.get(elementId) ?? {
			chapters: new Set<string>(),
			roles: new Set<ChapterRole | 'mention'>()
		};
		a.chapters.add(chapterId);
		a.roles.add(role);
		agg.set(elementId, a);
	};
	for (const r of db
		.select({
			chapterId: chapterRefs.chapterId,
			elementId: chapterRefs.elementId,
			role: chapterRefs.role
		})
		.from(chapterRefs)
		.where(inArray(chapterRefs.chapterId, chapterIds))
		.all())
		bump(r.elementId, r.chapterId, r.role as ChapterRole);
	for (const l of db
		.select({ sourceId: links.sourceId, targetId: links.targetId })
		.from(links)
		.where(and(eq(links.sourceKind, 'chapter'), inArray(links.sourceId, chapterIds)))
		.all())
		bump(l.targetId, l.sourceId, 'mention');
	if (agg.size === 0) return [];
	const info = db
		.select({
			id: elements.id,
			name: elements.name,
			slug: elements.slug,
			icon: elementTypes.icon,
			typeName: elementTypes.singular
		})
		.from(elements)
		.innerJoin(elementTypes, eq(elementTypes.id, elements.typeId))
		.where(inArray(elements.id, [...agg.keys()]))
		.all();
	const order: (ChapterRole | 'mention')[] = ['pov', 'location', 'cast', 'mention'];
	return info
		.map((e) => {
			const a = agg.get(e.id)!;
			return {
				elementId: e.id,
				name: e.name,
				slug: e.slug,
				icon: e.icon,
				typeName: e.typeName,
				chapters: a.chapters.size,
				roles: order.filter((r) => a.roles.has(r))
			};
		})
		.sort((a, b) => b.chapters - a.chapters || a.name.localeCompare(b.name));
}

/** Chapters (with manuscript) linked to a timeline event. */
export function chaptersForEvents(eventIds: string[]) {
	if (eventIds.length === 0)
		return new Map<
			string,
			{ chapterId: string; chapterTitle: string; manuscriptId: string; manuscriptTitle: string }[]
		>();
	const rows = db
		.select({
			eventId: chapters.eventId,
			chapterId: chapters.id,
			chapterTitle: chapters.title,
			manuscriptId: manuscripts.id,
			manuscriptTitle: manuscripts.title
		})
		.from(chapters)
		.innerJoin(manuscripts, eq(manuscripts.id, chapters.manuscriptId))
		.where(inArray(chapters.eventId, eventIds))
		.orderBy(asc(manuscripts.sortOrder), asc(chapters.sortOrder))
		.all();
	const out = new Map<string, typeof rows>();
	for (const r of rows) {
		if (!r.eventId) continue;
		out.set(r.eventId, [...(out.get(r.eventId) ?? []), r]);
	}
	return out;
}

/** Full-text-ish search across chapters of a world. */
export function searchChapters(worldId: string, q: string, limit = 30) {
	const term = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
	return db
		.select({
			id: chapters.id,
			title: chapters.title,
			synopsis: chapters.synopsis,
			status: chapters.status,
			wordCount: chapters.wordCount,
			manuscriptId: manuscripts.id,
			manuscriptTitle: manuscripts.title
		})
		.from(chapters)
		.innerJoin(manuscripts, eq(manuscripts.id, chapters.manuscriptId))
		.where(
			and(
				eq(manuscripts.worldId, worldId),
				or(
					sql`${chapters.title} like ${term} escape '\\'`,
					sql`${chapters.synopsis} like ${term} escape '\\'`,
					sql`${chapters.body} like ${term} escape '\\'`
				)
			)
		)
		.orderBy(asc(manuscripts.sortOrder), asc(chapters.sortOrder))
		.limit(limit)
		.all();
}

/** All chapters of a manuscript with bodies, for the read-through view. */
export function readManuscript(manuscriptId: string) {
	return db
		.select({
			id: chapters.id,
			title: chapters.title,
			synopsis: chapters.synopsis,
			body: chapters.body,
			status: chapters.status,
			wordCount: chapters.wordCount,
			eventId: chapters.eventId
		})
		.from(chapters)
		.where(eq(chapters.manuscriptId, manuscriptId))
		.orderBy(asc(chapters.sortOrder), asc(chapters.createdAt))
		.all();
}

// ---- writing workspace -----------------------------------------------------

/** A chapter looked up by id, scoped to a world through its manuscript. */
export function getChapterInWorld(worldId: string, chapterId: string) {
	return db
		.select({
			id: chapters.id,
			manuscriptId: chapters.manuscriptId,
			manuscriptTitle: manuscripts.title,
			title: chapters.title,
			synopsis: chapters.synopsis,
			body: chapters.body,
			status: chapters.status,
			wordCount: chapters.wordCount,
			sortOrder: chapters.sortOrder,
			eventId: chapters.eventId,
			updatedAt: chapters.updatedAt
		})
		.from(chapters)
		.innerJoin(manuscripts, eq(manuscripts.id, chapters.manuscriptId))
		.where(and(eq(manuscripts.worldId, worldId), eq(chapters.id, chapterId)))
		.get();
}

export interface BinderManuscript {
	id: string;
	title: string;
	wordCount: number;
	chapters: { id: string; title: string; status: string; wordCount: number }[];
}

/** Every manuscript with its chapters in reading order, for the workspace sidebar. */
export function binder(worldId: string): BinderManuscript[] {
	const ms = db
		.select({ id: manuscripts.id, title: manuscripts.title })
		.from(manuscripts)
		.where(eq(manuscripts.worldId, worldId))
		.orderBy(asc(manuscripts.sortOrder), asc(manuscripts.createdAt))
		.all();
	if (ms.length === 0) return [];
	const chs = db
		.select({
			id: chapters.id,
			manuscriptId: chapters.manuscriptId,
			title: chapters.title,
			status: chapters.status,
			wordCount: chapters.wordCount
		})
		.from(chapters)
		.where(
			inArray(
				chapters.manuscriptId,
				ms.map((m) => m.id)
			)
		)
		.orderBy(asc(chapters.sortOrder), asc(chapters.createdAt))
		.all();
	return ms.map((m) => {
		const list = chs.filter((c) => c.manuscriptId === m.id).map(({ manuscriptId: _m, ...c }) => c);
		return {
			id: m.id,
			title: m.title,
			wordCount: list.reduce((n, c) => n + c.wordCount, 0),
			chapters: list
		};
	});
}

/** The most recently edited chapter in a world, for "continue writing". */
export function latestChapter(worldId: string) {
	return db
		.select({
			id: chapters.id,
			title: chapters.title,
			manuscriptId: manuscripts.id,
			manuscriptTitle: manuscripts.title,
			updatedAt: chapters.updatedAt,
			wordCount: chapters.wordCount
		})
		.from(chapters)
		.innerJoin(manuscripts, eq(manuscripts.id, chapters.manuscriptId))
		.where(eq(manuscripts.worldId, worldId))
		.orderBy(sql`${chapters.updatedAt} desc`)
		.limit(1)
		.get();
}
