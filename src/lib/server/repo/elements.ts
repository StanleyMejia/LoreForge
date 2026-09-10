import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { slugify } from '$lib/slug';
import { extractWikiLinks } from '$lib/markdown';
import { panelsFromTemplate, panelsText, type Panel } from '$lib/types';
import { touchWorld } from './worlds';
import { indexElement, removeFromIndex } from './search';

const { elements, elementTypes, links, relationships, mapPins } = schema;

export type LinkKind = 'element' | 'event' | 'chapter';

const listCols = {
	id: elements.id,
	slug: elements.slug,
	name: elements.name,
	summary: elements.summary,
	tags: elements.tags,
	imageUrl: elements.imageUrl,
	typeId: elements.typeId,
	updatedAt: elements.updatedAt,
	typeKey: elementTypes.key,
	typeName: elementTypes.singular,
	typeIcon: elementTypes.icon,
	typeColor: elementTypes.color
};

export function listElements(worldId: string, typeId?: string) {
	const where = typeId
		? and(eq(elements.worldId, worldId), eq(elements.typeId, typeId))
		: eq(elements.worldId, worldId);
	return db
		.select(listCols)
		.from(elements)
		.innerJoin(elementTypes, eq(elementTypes.id, elements.typeId))
		.where(where)
		.orderBy(asc(elements.name))
		.all();
}

export function recentElements(worldId: string, limit = 8) {
	return db
		.select(listCols)
		.from(elements)
		.innerJoin(elementTypes, eq(elementTypes.id, elements.typeId))
		.where(eq(elements.worldId, worldId))
		.orderBy(desc(elements.updatedAt))
		.limit(limit)
		.all();
}

/** Lightweight name index for wiki-link resolution and pickers. */
export function elementIndex(worldId: string) {
	return db
		.select({
			id: elements.id,
			slug: elements.slug,
			name: elements.name,
			summary: elements.summary,
			typeKey: elementTypes.key,
			typeName: elementTypes.singular,
			icon: elementTypes.icon
		})
		.from(elements)
		.innerJoin(elementTypes, eq(elementTypes.id, elements.typeId))
		.where(eq(elements.worldId, worldId))
		.orderBy(asc(elements.name))
		.all();
}

export function getElement(worldId: string, slug: string) {
	return db
		.select()
		.from(elements)
		.where(and(eq(elements.worldId, worldId), eq(elements.slug, slug)))
		.get();
}

export function getElementById(id: string) {
	return db.select().from(elements).where(eq(elements.id, id)).get();
}

export function getElementsByIds(ids: string[]) {
	if (ids.length === 0) return [];
	return db
		.select(listCols)
		.from(elements)
		.innerJoin(elementTypes, eq(elementTypes.id, elements.typeId))
		.where(inArray(elements.id, ids))
		.all();
}

function uniqueSlug(worldId: string, name: string, excludeId?: string) {
	const base = slugify(name);
	let slug = base;
	for (let i = 2; ; i++) {
		const hit = getElement(worldId, slug);
		if (!hit || hit.id === excludeId) return slug;
		slug = `${base}-${i}`;
	}
}

export interface ElementInput {
	name: string;
	summary?: string;
	panels?: Panel[];
	tags?: string[];
	imageUrl?: string;
	typeId?: string;
}

export function createElement(worldId: string, typeId: string, input: ElementInput) {
	// No panels supplied (e.g. quick add): instantiate the type's template.
	const panels =
		input.panels ??
		panelsFromTemplate(
			db
				.select({ panels: elementTypes.panels })
				.from(elementTypes)
				.where(eq(elementTypes.id, typeId))
				.get()?.panels ?? []
		);
	const row = db
		.insert(elements)
		.values({
			worldId,
			typeId,
			slug: uniqueSlug(worldId, input.name),
			name: input.name.trim(),
			summary: input.summary ?? '',
			panels,
			tags: input.tags ?? [],
			imageUrl: input.imageUrl ?? ''
		})
		.returning()
		.get();
	syncLinks(worldId, 'element', row.id, panelsText(row.panels));
	indexElement(row);
	syncMapPins(worldId, row.id, row.panels);
	touchWorld(worldId);
	return row;
}

export function updateElement(worldId: string, id: string, input: ElementInput) {
	const existing = getElementById(id);
	if (!existing) return undefined;
	const name = input.name.trim();
	const slug = name === existing.name ? existing.slug : uniqueSlug(worldId, name, id);
	const row = db
		.update(elements)
		.set({
			name,
			slug,
			summary: input.summary ?? existing.summary,
			panels: input.panels ?? existing.panels,
			tags: input.tags ?? existing.tags,
			imageUrl: input.imageUrl ?? existing.imageUrl,
			typeId: input.typeId ?? existing.typeId,
			updatedAt: new Date()
		})
		.where(eq(elements.id, id))
		.returning()
		.get();
	syncLinks(worldId, 'element', row.id, panelsText(row.panels));
	indexElement(row);
	syncMapPins(worldId, row.id, row.panels);
	touchWorld(worldId);
	return row;
}

export function deleteElement(id: string) {
	db.delete(mapPins).where(eq(mapPins.mapElementId, id)).run();
	removeFromIndex('element', id);
	db.delete(links)
		.where(and(eq(links.sourceKind, 'element'), eq(links.sourceId, id)))
		.run();
	db.delete(elements).where(eq(elements.id, id)).run();
}

/** Recompute the implicit link table for one source document from its [[wiki links]]. */
export function syncLinks(worldId: string, kind: LinkKind, sourceId: string, body: string) {
	const names = extractWikiLinks(body);
	db.delete(links)
		.where(and(eq(links.sourceKind, kind), eq(links.sourceId, sourceId)))
		.run();
	if (names.length === 0) return;
	const index = elementIndex(worldId);
	const byName = new Map<string, string>();
	for (const e of index) {
		byName.set(e.name.toLowerCase(), e.id);
		byName.set(e.slug.toLowerCase(), e.id);
	}
	const targets = new Set<string>();
	for (const n of names) {
		const id = byName.get(n.toLowerCase());
		if (id && id !== sourceId) targets.add(id);
	}
	if (targets.size === 0) return;
	db.insert(links)
		.values([...targets].map((targetId) => ({ worldId, sourceKind: kind, sourceId, targetId })))
		.onConflictDoNothing()
		.run();
}

export interface Backlink {
	kind: LinkKind;
	id: string;
	title: string;
	href: string;
	icon: string;
}

export function backlinks(worldSlug: string, elementId: string): Backlink[] {
	const rows = db.select().from(links).where(eq(links.targetId, elementId)).all();
	const out: Backlink[] = [];
	const byKind = { element: [] as string[], event: [] as string[], chapter: [] as string[] };
	for (const r of rows) byKind[r.sourceKind as LinkKind]?.push(r.sourceId);

	if (byKind.element.length) {
		for (const e of getElementsByIds(byKind.element)) {
			out.push({
				kind: 'element',
				id: e.id,
				title: e.name,
				icon: e.typeIcon,
				href: `/w/${worldSlug}/e/${e.slug}`
			});
		}
	}
	if (byKind.event.length) {
		for (const ev of db
			.select({ id: schema.events.id, title: schema.events.title })
			.from(schema.events)
			.where(inArray(schema.events.id, byKind.event))
			.all()) {
			out.push({
				kind: 'event',
				id: ev.id,
				title: ev.title,
				icon: '🕰️',
				href: `/w/${worldSlug}/timeline#${ev.id}`
			});
		}
	}
	if (byKind.chapter.length) {
		for (const ch of db
			.select({
				id: schema.chapters.id,
				title: schema.chapters.title,
				manuscriptId: schema.chapters.manuscriptId
			})
			.from(schema.chapters)
			.where(inArray(schema.chapters.id, byKind.chapter))
			.all()) {
			out.push({
				kind: 'chapter',
				id: ch.id,
				title: ch.title,
				icon: '📖',
				href: `/w/${worldSlug}/m/${ch.manuscriptId}/c/${ch.id}`
			});
		}
	}
	return out.sort((a, b) => a.title.localeCompare(b.title));
}

// ---- relationships -------------------------------------------------------

export interface RelationshipView {
	id: string;
	label: string;
	notes: string;
	direction: 'out' | 'in';
	other: { id: string; slug: string; name: string; icon: string; typeName: string };
}

export function relationshipsFor(elementId: string): RelationshipView[] {
	const rows = db
		.select()
		.from(relationships)
		.where(or(eq(relationships.fromId, elementId), eq(relationships.toId, elementId)))
		.orderBy(asc(relationships.createdAt))
		.all();
	const otherIds = rows.map((r) => (r.fromId === elementId ? r.toId : r.fromId));
	const others = new Map(getElementsByIds(otherIds).map((e) => [e.id, e]));
	const out: RelationshipView[] = [];
	for (const r of rows) {
		const out_ = r.fromId === elementId;
		const other = others.get(out_ ? r.toId : r.fromId);
		if (!other) continue;
		out.push({
			id: r.id,
			label: out_ ? r.label : r.reverseLabel || r.label,
			notes: r.notes,
			direction: out_ ? 'out' : 'in',
			other: {
				id: other.id,
				slug: other.slug,
				name: other.name,
				icon: other.typeIcon,
				typeName: other.typeName
			}
		});
	}
	return out;
}

export function createRelationship(
	worldId: string,
	input: { fromId: string; toId: string; label: string; reverseLabel?: string; notes?: string }
) {
	touchWorld(worldId);
	return db
		.insert(relationships)
		.values({ worldId, ...input, reverseLabel: input.reverseLabel ?? '', notes: input.notes ?? '' })
		.returning()
		.get();
}

export function deleteRelationship(id: string) {
	db.delete(relationships).where(eq(relationships.id, id)).run();
}

export function allRelationships(worldId: string) {
	return db.select().from(relationships).where(eq(relationships.worldId, worldId)).all();
}

// ---- search --------------------------------------------------------------

export function searchElements(worldId: string, q: string, limit = 50) {
	const term = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
	return db
		.select(listCols)
		.from(elements)
		.innerJoin(elementTypes, eq(elementTypes.id, elements.typeId))
		.where(
			and(
				eq(elements.worldId, worldId),
				or(
					sql`${elements.name} like ${term} escape '\\'`,
					sql`${elements.summary} like ${term} escape '\\'`,
					sql`${elements.panels} like ${term} escape '\\'`,
					sql`${elements.tags} like ${term} escape '\\'`
				)
			)
		)
		.orderBy(asc(elements.name))
		.limit(limit)
		.all();
}

export function elementsByTag(worldId: string, tag: string) {
	return db
		.select(listCols)
		.from(elements)
		.innerJoin(elementTypes, eq(elementTypes.id, elements.typeId))
		.where(
			and(
				eq(elements.worldId, worldId),
				sql`exists (select 1 from json_each(${elements.tags}) where lower(value) = lower(${tag}))`
			)
		)
		.orderBy(asc(elements.name))
		.all();
}

export function allTags(worldId: string): { tag: string; count: number }[] {
	return db.all<{ tag: string; count: number }>(
		sql`select value as tag, count(*) as count from ${elements}, json_each(${elements.tags}) where ${elements.worldId} = ${worldId} group by value order by count desc, value asc`
	);
}

// ---- map pins ------------------------------------------------------------

/** Recompute the derived map_pins rows for one map element from its map panels. */
export function syncMapPins(worldId: string, mapElementId: string, panels: Panel[]) {
	db.delete(mapPins).where(eq(mapPins.mapElementId, mapElementId)).run();
	const rows: (typeof mapPins.$inferInsert)[] = [];
	for (const p of panels) {
		if (p.kind !== 'map') continue;
		for (const pin of p.pins) {
			if (pin.elementId && pin.elementId !== mapElementId) {
				rows.push({
					worldId,
					mapElementId,
					panelId: p.id,
					pinId: pin.id,
					elementId: pin.elementId,
					label: pin.label
				});
			}
		}
	}
	if (!rows.length) return;
	const valid = new Set(getElementsByIds(rows.map((r) => r.elementId)).map((e) => e.id));
	const keep = rows.filter((r) => valid.has(r.elementId));
	if (keep.length) db.insert(mapPins).values(keep).run();
}

export interface OnMap {
	mapId: string;
	mapName: string;
	mapSlug: string;
	panelId: string;
	pinId: string;
	label: string;
}

/** Maps an element is pinned on. */
export function onMaps(elementId: string): OnMap[] {
	return db
		.select({
			mapId: elements.id,
			mapName: elements.name,
			mapSlug: elements.slug,
			panelId: mapPins.panelId,
			pinId: mapPins.pinId,
			label: mapPins.label
		})
		.from(mapPins)
		.innerJoin(elements, eq(elements.id, mapPins.mapElementId))
		.where(eq(mapPins.elementId, elementId))
		.orderBy(asc(elements.name))
		.all();
}
