import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { MARK_CLOSE, MARK_OPEN } from '$lib/snippet';
import { panelsText, type Panel } from '$lib/types';

const { elements, elementTypes, events, chapters, manuscripts } = schema;

type SearchKind = 'element' | 'chapter' | 'event';

// ---- indexing (search_index is an FTS5 virtual table created by migration 0005) ------------

function upsert(worldId: string, kind: SearchKind, refId: string, title: string, body: string) {
	db.run(sql`delete from search_index where kind = ${kind} and ref_id = ${refId}`);
	db.run(
		sql`insert into search_index (world_id, kind, ref_id, title, body) values (${worldId}, ${kind}, ${refId}, ${title}, ${body})`
	);
}

export function indexElement(el: {
	id: string;
	worldId: string;
	name: string;
	summary: string;
	tags: string[];
	panels: Panel[];
}) {
	upsert(
		el.worldId,
		'element',
		el.id,
		el.name,
		[el.summary, el.tags.join(' '), panelsText(el.panels)].join('\n')
	);
}

export function indexChapter(
	worldId: string,
	ch: { id: string; title: string; synopsis: string; body: string }
) {
	upsert(worldId, 'chapter', ch.id, ch.title, [ch.synopsis, ch.body].join('\n'));
}

export function indexEvent(ev: {
	id: string;
	worldId: string;
	title: string;
	dateLabel: string;
	era: string;
	body: string;
}) {
	upsert(ev.worldId, 'event', ev.id, ev.title, [ev.dateLabel, ev.era, ev.body].join('\n'));
}

export function removeFromIndex(kind: SearchKind, refId: string) {
	db.run(sql`delete from search_index where kind = ${kind} and ref_id = ${refId}`);
}

/** Rebuild the index for one world (or all worlds when omitted). */
export function rebuildIndex(worldId?: string) {
	db.transaction(() => {
		if (worldId) db.run(sql`delete from search_index where world_id = ${worldId}`);
		else db.run(sql`delete from search_index`);
		for (const el of db
			.select()
			.from(elements)
			.where(worldId ? eq(elements.worldId, worldId) : undefined)
			.all())
			indexElement(el);
		for (const ev of db
			.select()
			.from(events)
			.where(worldId ? eq(events.worldId, worldId) : undefined)
			.all())
			indexEvent(ev);
		const chs = db
			.select({
				id: chapters.id,
				title: chapters.title,
				synopsis: chapters.synopsis,
				body: chapters.body,
				worldId: manuscripts.worldId
			})
			.from(chapters)
			.innerJoin(manuscripts, eq(manuscripts.id, chapters.manuscriptId))
			.where(worldId ? eq(manuscripts.worldId, worldId) : undefined)
			.all();
		for (const ch of chs) indexChapter(ch.worldId, ch);
	});
}

/** True when there is content but nothing indexed (fresh upgrade): triggers a rebuild on boot. */
export function indexNeedsRebuild(): boolean {
	const n = db.get<{ n: number }>(sql`select count(*) as n from search_index`)?.n ?? 0;
	if (n > 0) return false;
	return (db.get<{ n: number }>(sql`select count(*) as n from ${elements}`)?.n ?? 0) > 0;
}

// ---- querying ----------------------------------------------------------------------------

/** Turn free text into a safe FTS5 MATCH expression: quoted tokens, last one as a prefix. */
function toMatchQuery(q: string): string {
	const tokens = q
		.replace(/["'*^()]/g, ' ')
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 12);
	if (tokens.length === 0) return '';
	return tokens.map((t, i) => `"${t}"${i === tokens.length - 1 ? '*' : ''}`).join(' ');
}

export interface SearchHit {
	kind: SearchKind;
	id: string;
	title: string;
	/** Contains MARK_OPEN / MARK_CLOSE around matched terms. */
	snippet: string;
	rank: number;
	href: string;
	icon: string;
	subtitle: string;
}

interface RawHit {
	kind: SearchKind;
	ref_id: string;
	title: string;
	snippet: string;
	rank: number;
}

/** Full-text search over a world, best matches first. Throws on an unparsable query. */
export function searchWorld(
	worldId: string,
	q: string,
	worldSlug: string,
	limit = 40
): SearchHit[] {
	const match = toMatchQuery(q);
	if (!match) return [];
	const rows = db.all<RawHit>(
		sql`select kind, ref_id, title,
			snippet(search_index, 4, ${MARK_OPEN}, ${MARK_CLOSE}, '…', 14) as snippet,
			bm25(search_index, 0, 0, 0, 3.0, 1.0) as rank
			from search_index
			where world_id = ${worldId} and search_index match ${match}
			order by rank limit ${limit}`
	);
	return hydrate(rows, worldSlug);
}

function hydrate(rows: RawHit[], slug: string): SearchHit[] {
	const ids = (k: SearchKind) => rows.filter((r) => r.kind === k).map((r) => r.ref_id);
	const eIds = ids('element');
	const cIds = ids('chapter');
	const vIds = ids('event');
	const els = new Map(
		eIds.length
			? db
					.select({
						id: elements.id,
						slug: elements.slug,
						icon: elementTypes.icon,
						typeName: elementTypes.singular
					})
					.from(elements)
					.innerJoin(elementTypes, eq(elementTypes.id, elements.typeId))
					.where(sql`${elements.id} in ${eIds}`)
					.all()
					.map((e) => [e.id, e] as const)
			: []
	);
	const chs = new Map(
		cIds.length
			? db
					.select({ id: chapters.id, manuscriptTitle: manuscripts.title, status: chapters.status })
					.from(chapters)
					.innerJoin(manuscripts, eq(manuscripts.id, chapters.manuscriptId))
					.where(sql`${chapters.id} in ${cIds}`)
					.all()
					.map((c) => [c.id, c] as const)
			: []
	);
	const evs = new Map(
		vIds.length
			? db
					.select({ id: events.id, dateLabel: events.dateLabel, era: events.era })
					.from(events)
					.where(sql`${events.id} in ${vIds}`)
					.all()
					.map((e) => [e.id, e] as const)
			: []
	);
	const out: SearchHit[] = [];
	for (const r of rows) {
		const base = { kind: r.kind, id: r.ref_id, title: r.title, snippet: r.snippet, rank: r.rank };
		if (r.kind === 'element') {
			const e = els.get(r.ref_id);
			if (e)
				out.push({ ...base, href: `/w/${slug}/e/${e.slug}`, icon: e.icon, subtitle: e.typeName });
		} else if (r.kind === 'chapter') {
			const c = chs.get(r.ref_id);
			if (c)
				out.push({
					...base,
					href: `/w/${slug}/write/${r.ref_id}`,
					icon: '📖',
					subtitle: `${c.manuscriptTitle} · ${c.status}`
				});
		} else {
			const e = evs.get(r.ref_id);
			if (e)
				out.push({
					...base,
					href: `/w/${slug}/timeline#${e.id}`,
					icon: '🕰️',
					subtitle: [e.era, e.dateLabel].filter(Boolean).join(' · ') || 'Timeline'
				});
		}
	}
	return out;
}
