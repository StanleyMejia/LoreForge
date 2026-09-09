import type { FieldDef, FieldKind, Panel, PanelKind } from '$lib/types';
import { newId } from '$lib/types';
import { slugify } from '$lib/slug';

const FIELD_KINDS: FieldKind[] = ['text', 'textarea', 'number', 'select', 'element'];
const PANEL_KINDS: PanelKind[] = ['info', 'text', 'list', 'stats', 'links', 'gallery'];

const s = (v: unknown, max = 20000) => (typeof v === 'string' ? v.slice(0, max) : '');
const n = (v: unknown, fallback = 0) => {
	const x = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(x) ? x : fallback;
};

/** Validate attribute definitions; drops rows without a label, de-duplicates keys. */
export function cleanFields(raw: unknown): FieldDef[] {
	if (!Array.isArray(raw)) return [];
	const out: FieldDef[] = [];
	const keys = new Set<string>();
	for (const f of raw as Partial<FieldDef>[]) {
		const label = s(f?.label, 200).trim();
		if (!label) continue;
		const kind = FIELD_KINDS.includes(f.kind as FieldKind) ? (f.kind as FieldKind) : 'text';
		let key = s(f.key, 100).trim() || slugify(label).replace(/-/g, '_');
		while (keys.has(key)) key += '_';
		keys.add(key);
		const def: FieldDef = { key, label, kind };
		if (kind === 'select')
			def.options = (Array.isArray(f.options) ? f.options : [])
				.map((o) => s(o, 200).trim())
				.filter(Boolean);
		if (kind === 'element') def.ref = s(f.ref, 100).trim();
		out.push(def);
	}
	return out;
}

/**
 * Validate a panels array from the client. Unknown kinds are dropped; every panel gets an id.
 * `template` mode keeps only structure (field defs, titles) and empties content.
 */
export function cleanPanels(raw: unknown, template = false): Panel[] {
	if (!Array.isArray(raw)) return [];
	const out: Panel[] = [];
	const ids = new Set<string>();
	for (const p of raw as Record<string, unknown>[]) {
		if (!p || !PANEL_KINDS.includes(p.kind as PanelKind)) continue;
		let id = s(p.id, 40) || newId();
		while (ids.has(id)) id = newId();
		ids.add(id);
		const title = s(p.title, 200).trim() || 'Panel';
		switch (p.kind as PanelKind) {
			case 'info': {
				const fields = cleanFields(p.fields);
				const values: Record<string, string> = {};
				if (!template && p.values && typeof p.values === 'object') {
					for (const f of fields) {
						const v = s((p.values as Record<string, unknown>)[f.key], 5000).trim();
						if (v) values[f.key] = v;
					}
				}
				out.push({ id, kind: 'info', title, fields, values });
				break;
			}
			case 'text':
				out.push({ id, kind: 'text', title, body: template ? '' : s(p.body, 200000) });
				break;
			case 'list':
				out.push({
					id,
					kind: 'list',
					title,
					items: template
						? []
						: (Array.isArray(p.items) ? p.items : [])
								.map((i: Record<string, unknown>) => ({
									name: s(i?.name, 500).trim(),
									text: s(i?.text, 5000)
								}))
								.filter((i) => i.name || i.text.trim())
				});
				break;
			case 'stats':
				out.push({
					id,
					kind: 'stats',
					title,
					stats: template
						? []
						: (Array.isArray(p.stats) ? p.stats : [])
								.map((i: Record<string, unknown>) => ({
									name: s(i?.name, 200).trim(),
									value: n(i?.value),
									max: n(i?.max, 0)
								}))
								.filter((i) => i.name)
				});
				break;
			case 'links':
				out.push({
					id,
					kind: 'links',
					title,
					links: template
						? []
						: (Array.isArray(p.links) ? p.links : [])
								.map((i: Record<string, unknown>) => ({
									elementId: s(i?.elementId, 80),
									note: s(i?.note, 500).trim()
								}))
								.filter((i) => i.elementId)
				});
				break;
			case 'gallery':
				out.push({
					id,
					kind: 'gallery',
					title,
					images: template
						? []
						: (Array.isArray(p.images) ? p.images : [])
								.map((i: Record<string, unknown>) => ({
									url: s(i?.url, 2000).trim(),
									caption: s(i?.caption, 500).trim()
								}))
								.filter((i) => /^(https?:\/\/|\/|data:image\/)/i.test(i.url))
				});
				break;
		}
	}
	return out;
}
