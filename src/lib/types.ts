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

export type PanelKind = 'info' | 'text' | 'list' | 'stats' | 'links' | 'gallery';

interface PanelBase {
	id: string;
	title: string;
}
/** Key/value attributes. Field definitions live on the panel so each element can add its own. */
export interface InfoPanel extends PanelBase {
	kind: 'info';
	fields: FieldDef[];
	values: Record<string, string>;
}
/** Free-form markdown. Supports [[wiki links]]. */
export interface TextPanel extends PanelBase {
	kind: 'text';
	body: string;
}
/** Organised list: named items with a short description. */
export interface ListPanel extends PanelBase {
	kind: 'list';
	items: { name: string; text: string }[];
}
/** Numeric stats rendered as bars. */
export interface StatsPanel extends PanelBase {
	kind: 'stats';
	stats: { name: string; value: number; max: number }[];
}
/** Curated links to other elements. */
export interface LinksPanel extends PanelBase {
	kind: 'links';
	links: { elementId: string; note: string }[];
}
/** Image gallery by URL. */
export interface GalleryPanel extends PanelBase {
	kind: 'gallery';
	images: { url: string; caption: string }[];
}

export type Panel = InfoPanel | TextPanel | ListPanel | StatsPanel | LinksPanel | GalleryPanel;

export const PANEL_KINDS: { kind: PanelKind; label: string; icon: string; blurb: string }[] = [
	{ kind: 'info', label: 'Attributes', icon: 'ℹ️', blurb: 'Key facts as labelled fields.' },
	{ kind: 'text', label: 'Text', icon: '📝', blurb: 'Notes, backstory, and more.' },
	{ kind: 'list', label: 'List', icon: '☰', blurb: 'Organised, named list items.' },
	{ kind: 'stats', label: 'Statistics', icon: '📊', blurb: 'Numeric values as bars.' },
	{ kind: 'links', label: 'Links', icon: '🔗', blurb: 'Connect to other elements.' },
	{ kind: 'gallery', label: 'Images', icon: '🖼️', blurb: 'Image URLs with captions.' }
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
export function panelsText(panels: Panel[]): string {
	const parts: string[] = [];
	for (const p of panels) {
		if (p.kind === 'text') parts.push(p.body);
		else if (p.kind === 'list') for (const i of p.items) parts.push(i.name, i.text);
		else if (p.kind === 'info') parts.push(...Object.values(p.values));
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
