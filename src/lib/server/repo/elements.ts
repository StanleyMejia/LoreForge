import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { slugify, uniquify } from '$lib/slug';
import { ancestors, MAX_DEPTH } from '$lib/tree';
import { extractWikiLinks } from '$lib/markdown';
import { panelsFromTemplate, panelsText, type Panel } from '$lib/types';
import { touchWorld } from './worlds';
import { indexElement, removeFromIndex } from './search';
import { deleteRevisions, maybeRevision } from './revisions';
import { pruneComments } from './comments';

const { elements, elementTypes, links, relationships, mapPins } = schema;

type LinkKind = 'element' | 'event' | 'chapter';

const listCols = {
	id: elements.id,
	slug: elements.slug,
	name: elements.name,
	summary: elements.summary,
	tags: elements.tags,
	imageUrl: elements.imageUrl,
	typeId: elements.typeId,
	parentId: elements.parentId,
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
			parentId: elements.parentId,
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
	return uniquify(slugify(name), (s) => {
		const hit = getElement(worldId, s);
		return !!hit && hit.id !== excludeId;
	});
}

export interface ElementInput {
	name: string;
	summary?: string;
	panels?: Panel[];
	tags?: string[];
	imageUrl?: string;
	typeId?: string;
	/** Undefined leaves the current parent alone; null clears it. */
	parentId?: string | null;
}

/**
 * Why `parentId` cannot contain `id`, or null when it can. Walking up from the proposed
 * parent is bounded by depth rather than by subtree size, so it stays cheap.
 * ponytail: caps the element's own depth, not its descendants'. The tree render is depth-bounded
 * too, so deeper data still displays; tighten here if a real limit is ever needed.
 */
export function parentProblem(
	worldId: string,
	id: string | null,
	parentId: string | null
): string | null {
	if (!parentId) return null;
	if (id && parentId === id) return 'An element cannot be inside itself.';
	const parent = getElementById(parentId);
	if (!parent || parent.worldId !== worldId) return 'That parent is not in this world.';
	const chain = ancestors(parentId, (x) => getElementById(x)?.parentId);
	if (id && chain.includes(id)) return 'That would put the two inside each other.';
	if (chain.length + 1 >= MAX_DEPTH) return 'That nests too deeply.';
	return null;
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
			imageUrl: input.imageUrl ?? '',
			parentId: parentProblem(worldId, null, input.parentId ?? null)
				? null
				: (input.parentId ?? null)
		})
		.returning()
		.get();
	syncLinks(worldId, 'element', row.id, panelsText(row.panels));
	indexElement(row);
	syncMapPins(worldId, row.id, row.panels);
	touchWorld(worldId);
	return row;
}

export function updateElement(
	worldId: string,
	id: string,
	input: ElementInput,
	authorId: string | null = null
) {
	const existing = getElementById(id);
	if (!existing) return undefined;
	const name = input.name.trim();
	const slug = name === existing.name ? existing.slug : uniqueSlug(worldId, name, id);
	const summary = input.summary ?? existing.summary;
	const panels = input.panels ?? existing.panels;
	const tags = input.tags ?? existing.tags;
	const imageUrl = input.imageUrl ?? existing.imageUrl;
	const typeId = input.typeId ?? existing.typeId;
	// An invalid parent is refused rather than stored, whatever the caller passed.
	const proposed = input.parentId === undefined ? existing.parentId : input.parentId;
	const parentId = parentProblem(worldId, id, proposed) ? existing.parentId : proposed;
	// cleanPanels canonicalises panels on every write, so their JSON is byte-comparable.
	// ponytail: a reordered-but-equivalent panels array counts as changed. The cost is one
	// spare revision, never a wrong result; compare structurally if that ever matters.
	if (
		name === existing.name &&
		summary === existing.summary &&
		JSON.stringify(panels) === JSON.stringify(existing.panels) &&
		JSON.stringify(tags) === JSON.stringify(existing.tags) &&
		imageUrl === existing.imageUrl &&
		typeId === existing.typeId &&
		parentId === existing.parentId
	)
		return existing;
	maybeRevision({
		worldId,
		kind: 'element',
		docId: id,
		title: existing.name,
		authorId,
		content: JSON.stringify({
			summary: existing.summary,
			panels: existing.panels,
			tags: existing.tags,
			imageUrl: existing.imageUrl,
			typeId: existing.typeId,
			parentId: existing.parentId
		})
	});
	const row = db
		.update(elements)
		.set({
			name,
			slug,
			summary,
			panels,
			tags,
			imageUrl,
			typeId,
			parentId,
			updatedAt: new Date()
		})
		.where(eq(elements.id, id))
		.returning()
		.get();
	syncLinks(worldId, 'element', row.id, panelsText(row.panels));
	indexElement(row);
	syncMapPins(worldId, row.id, row.panels);
	pruneComments(
		row.id,
		row.panels.map((p) => p.id)
	);
	touchWorld(worldId);
	return row;
}

/**
 * What sits directly inside an element, of any type. The breadcrumb looks up the chain; this is
 * the view down it, and without it a child is invisible from its parent — a faction nested in a
 * location appears in neither type's tree, because a tree only ever holds one type.
 */
export function childrenOf(worldId: string, parentId: string) {
	return db
		.select(listCols)
		.from(elements)
		.innerJoin(elementTypes, eq(elementTypes.id, elements.typeId))
		.where(and(eq(elements.worldId, worldId), eq(elements.parentId, parentId)))
		.orderBy(asc(elementTypes.sortOrder), asc(elements.name))
		.all();
}

/** The containment chain of an element, outermost first, for breadcrumbs. */
export function ancestorTrail(id: string): { id: string; name: string; slug: string }[] {
	const cache = new Map<string, ReturnType<typeof getElementById>>();
	const at = (x: string) => {
		if (!cache.has(x)) cache.set(x, getElementById(x));
		return cache.get(x);
	};
	const chain = ancestors(id, (x) => at(x)?.parentId);
	if (!chain.length) return [];
	const by = new Map(getElementsByIds(chain).map((e) => [e.id, e]));
	return chain
		.reverse()
		.map((x) => by.get(x))
		.filter((e) => e !== undefined)
		.map((e) => ({ id: e.id, name: e.name, slug: e.slug }));
}

export function deleteElement(id: string) {
	db.delete(mapPins).where(eq(mapPins.mapElementId, id)).run();
	removeFromIndex('element', id);
	deleteRevisions('element', id);
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

interface Backlink {
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

interface RelationshipView {
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

/**
 * Of the given elements, those that own map pins — the ones a pin can lead further into.
 * Reads the derived map_pins table, which is already maintained on every element save, so
 * no panel JSON has to be loaded into the element lists.
 * ponytail: "leads somewhere" means the target owns at least one linked pin, so a map image
 * with no pins on it is not marked. A pinless map is a dead end, which is arguably right.
 */
export function mapOwners(ids: string[]): Set<string> {
	if (!ids.length) return new Set();
	return new Set(
		db
			.selectDistinct({ id: mapPins.mapElementId })
			.from(mapPins)
			.where(inArray(mapPins.mapElementId, ids))
			.all()
			.map((r) => r.id)
	);
}

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

interface OnMap {
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
