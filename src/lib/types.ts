export type FieldKind = 'text' | 'textarea' | 'number' | 'select' | 'element';

/** One attribute inside a Basic Information panel. */
export interface FieldDef {
	key: string;
	label: string;
	kind: FieldKind;
	/** For kind === 'select' */
	options?: string[];
	/** For kind === 'element': restrict to elements of this type key (empty = any) */
	ref?: string;
}

export type PanelKind = 'info' | 'text' | 'list' | 'stats' | 'links' | 'gallery' | 'map';

interface PanelBase {
	id: string;
	title: string;
}
/** Key/value attributes. Field definitions live on the panel so each element can add its own. */
interface InfoPanel extends PanelBase {
	kind: 'info';
	fields: FieldDef[];
	values: Record<string, string>;
}
/** Free-form markdown. Supports [[wiki links]]. */
interface TextPanel extends PanelBase {
	kind: 'text';
	body: string;
}
/** Organised list: named items with a short description. */
interface ListPanel extends PanelBase {
	kind: 'list';
	items: { name: string; text: string }[];
}
/** Numeric stats rendered as bars. */
interface StatsPanel extends PanelBase {
	kind: 'stats';
	stats: { name: string; value: number; max: number }[];
}
/** Curated links to other elements. */
interface LinksPanel extends PanelBase {
	kind: 'links';
	links: { elementId: string; note: string }[];
}
/** Image gallery by URL. */
interface GalleryPanel extends PanelBase {
	kind: 'gallery';
	images: { url: string; caption: string }[];
}
/** A pin on a map image. x/y are fractions (0..1) of the image size. */
export interface MapPin {
	id: string;
	x: number;
	y: number;
	label: string;
	elementId: string;
	color: string;
}
/** An image with interactive pins that can link to any element. */
export interface MapPanel extends PanelBase {
	kind: 'map';
	imageUrl: string;
	pins: MapPin[];
}

export type Panel =
	InfoPanel | TextPanel | ListPanel | StatsPanel | LinksPanel | GalleryPanel | MapPanel;

export const PANEL_KINDS: { kind: PanelKind; label: string; icon: string; blurb: string }[] = [
	{ kind: 'info', label: 'Attributes', icon: 'ℹ️', blurb: 'Key facts as labelled fields.' },
	{ kind: 'text', label: 'Text', icon: '📝', blurb: 'Notes, backstory, and more.' },
	{ kind: 'list', label: 'List', icon: '☰', blurb: 'Organised, named list items.' },
	{ kind: 'stats', label: 'Statistics', icon: '📊', blurb: 'Numeric values as bars.' },
	{ kind: 'links', label: 'Links', icon: '🔗', blurb: 'Connect to other elements.' },
	{ kind: 'gallery', label: 'Images', icon: '🖼️', blurb: 'Image URLs with captions.' },
	{ kind: 'map', label: 'Map', icon: '🗺️', blurb: 'An image with pins linked to elements.' }
];

export function panelIcon(kind: PanelKind): string {
	return PANEL_KINDS.find((k) => k.kind === kind)?.icon ?? '📄';
}

export function newId(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID().slice(0, 8)
		: Math.random().toString(36).slice(2, 10);
}

/** Empty panel of a given kind. */
export function blankPanel(kind: PanelKind, title = ''): Panel {
	const base = {
		id: newId(),
		title: title || PANEL_KINDS.find((k) => k.kind === kind)?.label || 'Panel'
	};
	switch (kind) {
		case 'info':
			return { ...base, kind, fields: [], values: {} };
		case 'text':
			return { ...base, kind, body: '' };
		case 'list':
			return { ...base, kind, items: [] };
		case 'stats':
			return { ...base, kind, stats: [] };
		case 'links':
			return { ...base, kind, links: [] };
		case 'gallery':
			return { ...base, kind, images: [] };
		case 'map':
			return { ...base, kind, imageUrl: '', pins: [] };
	}
}

/** Instantiate a type's template for a new element: fresh ids, empty content. */
export function panelsFromTemplate(template: Panel[]): Panel[] {
	return template.map((p) => {
		const blank = blankPanel(p.kind, p.title);
		if (p.kind === 'info' && blank.kind === 'info') blank.fields = p.fields.map((f) => ({ ...f }));
		return blank;
	});
}

/** All prose in an element (for wiki-link extraction and search). */
/**
 * Copy a type's select options onto an element's matching select fields (elements keep their own
 * copy of field defs). An element's chosen value stays listed even if the type dropped it.
 * Mutates `panels`; returns whether anything changed.
 */
export function syncSelectOptions(template: Panel[], panels: Panel[]): boolean {
	const opts = new Map<string, string[]>();
	for (const p of template)
		if (p.kind === 'info')
			for (const f of p.fields) if (f.kind === 'select') opts.set(f.key, f.options ?? []);
	let changed = false;
	for (const p of panels) {
		if (p.kind !== 'info') continue;
		for (const f of p.fields) {
			const o = f.kind === 'select' ? opts.get(f.key) : undefined;
			if (!o) continue;
			const v = p.values[f.key];
			const next = v && !o.includes(v) ? [...o, v] : [...o];
			if (JSON.stringify(next) === JSON.stringify(f.options ?? [])) continue;
			f.options = next;
			changed = true;
		}
	}
	return changed;
}

/**
 * Add attributes a type's template has gained to an element's matching info panel, empty. Only
 * fields that are new since `before` are added, so a field someone removed from one element on
 * purpose is not put back by an unrelated save. Each lands after the field that precedes it in the
 * template when the element has that field, otherwise at the end. Mutates `panels`; returns whether
 * anything changed.
 */
export function addNewFields(before: Panel[], after: Panel[], panels: Panel[]): boolean {
	const had = new Set<string>();
	for (const p of before) if (p.kind === 'info') for (const f of p.fields) had.add(f.key);
	let changed = false;
	for (const tp of after) {
		if (tp.kind !== 'info') continue;
		const target =
			panels.find((p) => p.kind === 'info' && p.title === tp.title) ??
			panels.find((p) => p.kind === 'info');
		if (!target || target.kind !== 'info') continue;
		tp.fields.forEach((f, i) => {
			if (had.has(f.key) || target.fields.some((x) => x.key === f.key)) return;
			const prev = tp.fields
				.slice(0, i)
				.reverse()
				.find((x) => target.fields.some((y) => y.key === x.key));
			const at = prev
				? target.fields.findIndex((y) => y.key === prev.key) + 1
				: target.fields.length;
			target.fields.splice(at, 0, { ...f });
			changed = true;
		});
	}
	return changed;
}

/** Key of the legacy "Located in" attribute that older Location templates carry beside Inside. */
export const LOCATED_IN = 'parent';

/** The legacy "Located in" value on an element, if it has that attribute. */
export function locatedIn(panels: Panel[]): string | null | undefined {
	for (const p of panels)
		if (p.kind === 'info' && p.fields.some((f) => f.key === LOCATED_IN && f.kind === 'element'))
			return p.values[LOCATED_IN] || null;
	return undefined;
}

/** Set the legacy "Located in" attribute to `parentId`. Mutates; returns whether anything changed. */
export function mirrorParent(panels: Panel[], parentId: string | null): boolean {
	let changed = false;
	for (const p of panels) {
		if (p.kind !== 'info') continue;
		if (!p.fields.some((f) => f.key === LOCATED_IN && f.kind === 'element')) continue;
		if ((p.values[LOCATED_IN] || null) === parentId) continue;
		if (parentId) p.values[LOCATED_IN] = parentId;
		else delete p.values[LOCATED_IN];
		changed = true;
	}
	return changed;
}

export function panelsText(panels: Panel[]): string {
	const parts: string[] = [];
	for (const p of panels) {
		if (p.kind === 'text') parts.push(p.body);
		else if (p.kind === 'list') for (const i of p.items) parts.push(i.name, i.text);
		else if (p.kind === 'info') parts.push(...Object.values(p.values));
		else if (p.kind === 'map') for (const pin of p.pins) parts.push(pin.label);
	}
	return parts.join('\n');
}

export const CHAPTER_STATUSES = ['draft', 'revised', 'final'] as const;
export type ChapterStatus = (typeof CHAPTER_STATUSES)[number];

export const CHAPTER_ROLES = ['pov', 'location', 'cast'] as const;
export type ChapterRole = (typeof CHAPTER_ROLES)[number];
export const ROLE_LABELS: Record<ChapterRole | 'mention', string> = {
	pov: 'POV',
	location: 'Location',
	cast: 'Cast',
	mention: 'Mentioned'
};

/** A panel prepared for display: markdown rendered, element refs resolved. */
export type ViewPanel =
	| {
			id: string;
			kind: 'info';
			title: string;
			rows: {
				/** The field key: unique within a panel, unlike the label, so it is safe to key on. */
				key: string;
				label: string;
				kind: string;
				value: string;
				href: string | null;
				icon: string | null;
			}[];
	  }
	| { id: string; kind: 'text'; title: string; html: string }
	| { id: string; kind: 'list'; title: string; items: { name: string; html: string }[] }
	| {
			id: string;
			kind: 'stats';
			title: string;
			stats: { name: string; value: number; max: number }[];
	  }
	| {
			id: string;
			kind: 'links';
			title: string;
			links: { name: string; slug: string; icon: string; typeName: string; note: string }[];
	  }
	| { id: string; kind: 'gallery'; title: string; images: { url: string; caption: string }[] }
	| { id: string; kind: 'map'; title: string; imageUrl: string; pins: ViewPin[] };

export type ViewPin = MapPin & {
	element: { name: string; slug: string; icon: string; summary: string } | null;
	/** The target has a map of its own, so this pin leads further in. */
	childMap?: boolean;
};
