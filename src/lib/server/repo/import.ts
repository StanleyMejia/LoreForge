import { eq } from 'drizzle-orm';
import { db, schema } from '../db';
import { slugify, uniquify } from '$lib/slug';
import { num, str } from '../coerce';
import { panelsText, type Panel } from '$lib/types';
import { cleanPanels } from '../panels';
import { copyStored } from '../uploads';
import { syncLinks, syncMapPins } from './elements';
import { uniqueWorldSlug } from './worlds';
import { rebuildIndex } from './search';

const {
	worlds,
	elementTypes,
	elements,
	relationships,
	events,
	manuscripts,
	chapters,
	chapterRefs,
	uploads,
	worldMembers
} = schema;

interface ImportSummary {
	slug: string;
	name: string;
	counts: Record<string, number>;
	warnings: string[];
}

export class ImportError extends Error {}

const arr = (v: unknown): Record<string, unknown>[] =>
	Array.isArray(v) ? (v as Record<string, unknown>[]) : [];

/** Parse and sanity-check an exported bundle. */
export function parseBundle(text: string): Record<string, unknown> {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		throw new ImportError('That file is not valid JSON.');
	}
	if (!data || typeof data !== 'object')
		throw new ImportError('That file is not a Loreforge export.');
	const b = data as Record<string, unknown>;
	if (b.format !== 'loreforge-world')
		throw new ImportError('That file is not a Loreforge world export.');
	const version = num(b.version, 0);
	if (version < 1 || version > 2)
		throw new ImportError(
			`Unsupported export version ${version}. This build reads versions 1 and 2.`
		);
	if (!b.world || typeof b.world !== 'object')
		throw new ImportError('The export contains no world.');
	return b;
}

/**
 * Restore an exported world as a **new** world. Every id is reissued and all cross-references
 * (element links, relationships, chapter references, map pins, uploaded image URLs) are rewritten
 * to the new ids, so the copy is self-contained and the original world is untouched.
 */
export function importWorld(
	bundle: Record<string, unknown>,
	opts: { name?: string; owner?: { id: string; email: string } }
): ImportSummary {
	const srcWorld = bundle.world as Record<string, unknown>;
	const name = (opts.name?.trim() || str(srcWorld.name, 200) || 'Imported world').slice(0, 200);
	const warnings: string[] = [];

	const newId = () => crypto.randomUUID();
	const idMap = (rows: Record<string, unknown>[]) =>
		new Map(rows.map((r) => [str(r.id, 80), newId()]));

	const srcTypes = arr(bundle.types);
	const srcElements = arr(bundle.elements);
	const srcEvents = arr(bundle.events);
	const srcManuscripts = arr(bundle.manuscripts);
	const srcChapters = arr(bundle.chapters);
	const srcUploads = arr(bundle.uploads);

	const typeMap = idMap(srcTypes);
	const elementMap = idMap(srcElements);
	const eventMap = idMap(srcEvents);
	const manuscriptMap = idMap(srcManuscripts);
	const chapterMap = idMap(srcChapters);
	const uploadMap = idMap(srcUploads);

	const worldId = newId();
	const slug = uniqueWorldSlug(name);

	/** Point `/w/<old world>/files/<old id>` URLs at this world's copies of those files. */
	const remapText = (s: string) =>
		s.replace(/\/w\/[^/\s"')\]]+\/files\/([0-9a-fA-F-]{36})/g, (m, fileId: string) => {
			const to = uploadMap.get(fileId);
			return to ? `/w/${slug}/files/${to}` : m;
		});
	const remapElement = (old: string) => elementMap.get(old) ?? '';

	/** Rewrite every element reference and image URL inside a panel list. */
	function remapPanels(raw: unknown): Panel[] {
		const panels = cleanPanels(raw);
		for (const p of panels) {
			if (p.kind === 'info') {
				for (const f of p.fields) {
					if (f.kind !== 'element') continue;
					const current = p.values[f.key];
					if (!current) continue;
					const to = remapElement(current);
					if (to) p.values[f.key] = to;
					else delete p.values[f.key];
				}
			} else if (p.kind === 'links') {
				p.links = p.links
					.map((l) => ({ ...l, elementId: remapElement(l.elementId) }))
					.filter((l) => l.elementId);
			} else if (p.kind === 'map') {
				p.imageUrl = remapText(p.imageUrl);
				p.pins = p.pins.map((pin) => ({
					...pin,
					elementId: pin.elementId ? remapElement(pin.elementId) : ''
				}));
			} else if (p.kind === 'gallery') {
				p.images = p.images.map((i) => ({ ...i, url: remapText(i.url) }));
			} else if (p.kind === 'text') {
				p.body = remapText(p.body);
			} else if (p.kind === 'list') {
				p.items = p.items.map((i) => ({ ...i, text: remapText(i.text) }));
			}
		}
		return panels;
	}

	// Copy uploaded files first: rows are inserted only for files that are actually present.
	const uploadRows: (typeof uploads.$inferInsert)[] = [];
	for (const u of srcUploads) {
		const id = uploadMap.get(str(u.id, 80))!;
		const stored = copyStored(str(u.storagePath, 500), worldId, id);
		if (!stored) {
			warnings.push(`Image “${str(u.filename, 200)}” was not found on disk and was skipped.`);
			continue;
		}
		uploadRows.push({
			id,
			worldId,
			filename: str(u.filename, 200),
			mime: str(u.mime, 100) || 'image/png',
			size: num(u.size),
			storagePath: stored,
			createdBy: opts.owner?.id ?? null
		});
	}

	const counts: Record<string, number> = {};
	db.transaction((tx) => {
		tx.insert(worlds)
			.values({ id: worldId, slug, name, description: str(srcWorld.description, 5000) })
			.run();
		if (opts.owner) {
			tx.insert(worldMembers)
				.values({
					worldId,
					userId: opts.owner.id,
					email: opts.owner.email || `user:${opts.owner.id}`,
					role: 'owner'
				})
				.run();
		}

		const usedKeys = new Set<string>();
		const typeRows = srcTypes.map((t, i) => {
			const key = uniquify(slugify(str(t.key, 100) || str(t.singular, 200) || `type-${i}`), (k) =>
				usedKeys.has(k)
			);
			usedKeys.add(key);
			return {
				id: typeMap.get(str(t.id, 80))!,
				worldId,
				key,
				name: str(t.name, 200) || 'Type',
				singular: str(t.singular, 200) || 'Item',
				icon: str(t.icon, 16) || '📄',
				color: str(t.color, 32) || '#94a3b8',
				sortOrder: num(t.sortOrder, i),
				panels: cleanPanels(t.panels, true)
			};
		});
		if (typeRows.length) tx.insert(elementTypes).values(typeRows).run();
		counts.types = typeRows.length;

		const usedSlugs = new Set<string>();
		const elementRows = srcElements
			.map((e) => {
				const typeId = typeMap.get(str(e.typeId, 80));
				if (!typeId) return null;
				const slug = uniquify(slugify(str(e.slug, 200) || str(e.name, 200)), (s) =>
					usedSlugs.has(s)
				);
				usedSlugs.add(slug);
				return {
					id: elementMap.get(str(e.id, 80))!,
					worldId,
					typeId,
					slug,
					name: str(e.name, 200) || 'Untitled',
					summary: str(e.summary, 2000),
					panels: remapPanels(e.panels),
					tags: Array.isArray(e.tags)
						? (e.tags as unknown[]).map((t) => str(t, 100)).filter(Boolean)
						: [],
					imageUrl: remapText(str(e.imageUrl, 2000)),
					// Set after the insert: a child may precede its parent in the bundle, and the
					// self-referencing foreign key is checked per row.
					parentId: null
				};
			})
			.filter((r) => r !== null);
		if (elementRows.length) tx.insert(elements).values(elementRows).run();
		for (const e of arr(bundle.elements)) {
			const id = elementMap.get(str(e.id, 80));
			const parentId = elementMap.get(str(e.parentId, 80));
			if (id && parentId && id !== parentId)
				tx.update(elements).set({ parentId }).where(eq(elements.id, id)).run();
		}
		counts.elements = elementRows.length;

		const relRows = arr(bundle.relationships)
			.map((r) => {
				const fromId = elementMap.get(str(r.fromId, 80));
				const toId = elementMap.get(str(r.toId, 80));
				if (!fromId || !toId) return null;
				return {
					worldId,
					fromId,
					toId,
					label: str(r.label, 200) || 'related to',
					reverseLabel: str(r.reverseLabel, 200),
					notes: str(r.notes, 2000)
				};
			})
			.filter((r) => r !== null);
		if (relRows.length) tx.insert(relationships).values(relRows).run();
		counts.relationships = relRows.length;

		const eventRows = srcEvents.map((e) => ({
			id: eventMap.get(str(e.id, 80))!,
			worldId,
			title: str(e.title, 300) || 'Event',
			dateLabel: str(e.dateLabel, 200),
			sortKey: num(e.sortKey),
			era: str(e.era, 200),
			body: remapText(str(e.body, 200000))
		}));
		if (eventRows.length) tx.insert(events).values(eventRows).run();
		counts.events = eventRows.length;

		const manuscriptRows = srcManuscripts.map((m, i) => ({
			id: manuscriptMap.get(str(m.id, 80))!,
			worldId,
			title: str(m.title, 300) || 'Manuscript',
			description: str(m.description, 5000),
			sortOrder: num(m.sortOrder, i)
		}));
		if (manuscriptRows.length) tx.insert(manuscripts).values(manuscriptRows).run();
		counts.manuscripts = manuscriptRows.length;

		const chapterRows = srcChapters
			.map((c, i) => {
				const manuscriptId = manuscriptMap.get(str(c.manuscriptId, 80));
				if (!manuscriptId) return null;
				const status = str(c.status, 20);
				return {
					id: chapterMap.get(str(c.id, 80))!,
					manuscriptId,
					title: str(c.title, 300) || 'Chapter',
					synopsis: str(c.synopsis, 2000),
					body: remapText(str(c.body, 2_000_000)),
					status: ['draft', 'revised', 'final'].includes(status) ? status : 'draft',
					wordCount: num(c.wordCount),
					sortOrder: num(c.sortOrder, i),
					eventId: c.eventId ? (eventMap.get(str(c.eventId, 80)) ?? null) : null
				};
			})
			.filter((r) => r !== null);
		if (chapterRows.length) tx.insert(chapters).values(chapterRows).run();
		counts.chapters = chapterRows.length;

		const refRows = arr(bundle.chapterRefs)
			.map((r, i) => {
				const chapterId = chapterMap.get(str(r.chapterId, 80));
				const elementId = elementMap.get(str(r.elementId, 80));
				const role = str(r.role, 20);
				if (!chapterId || !elementId || !['pov', 'location', 'cast'].includes(role)) return null;
				return {
					chapterId,
					elementId,
					role: role as 'pov' | 'location' | 'cast',
					note: str(r.note, 500),
					sortOrder: num(r.sortOrder, i)
				};
			})
			.filter((r) => r !== null);
		if (refRows.length) tx.insert(chapterRefs).values(refRows).run();
		counts.chapterRefs = refRows.length;

		if (uploadRows.length) tx.insert(uploads).values(uploadRows).run();
		counts.uploads = uploadRows.length;
	});

	// Rebuild everything derived from content: wiki links, map pins, full-text index.
	for (const e of db.select().from(elements).where(eq(elements.worldId, worldId)).all()) {
		syncLinks(worldId, 'element', e.id, panelsText(e.panels));
		syncMapPins(worldId, e.id, e.panels);
	}
	for (const ev of db.select().from(events).where(eq(events.worldId, worldId)).all()) {
		syncLinks(worldId, 'event', ev.id, ev.body);
	}
	for (const ch of db
		.select({ id: chapters.id, body: chapters.body })
		.from(chapters)
		.innerJoin(manuscripts, eq(manuscripts.id, chapters.manuscriptId))
		.where(eq(manuscripts.worldId, worldId))
		.all()) {
		syncLinks(worldId, 'chapter', ch.id, ch.body);
	}
	rebuildIndex(worldId);

	return { slug, name, counts, warnings };
}
