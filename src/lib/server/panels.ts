import type { FieldDef, FieldKind, Panel, PanelKind } from '$lib/types';
import { newId } from '$lib/types';
import { slugify } from '$lib/slug';
import { num, str } from './coerce';

const FIELD_KINDS: FieldKind[] = ['text', 'textarea', 'number', 'select', 'element'];
const PANEL_KINDS: PanelKind[] = ['info', 'text', 'list', 'stats', 'links', 'gallery', 'map'];
const IMAGE_URL = /^(https?:\/\/|\/|data:image\/)/i;

/** Validate attribute definitions; drops rows without a label, de-duplicates keys. */
function cleanFields(raw: unknown): FieldDef[] {
	if (!Array.isArray(raw)) return [];
	const out: FieldDef[] = [];
	const keys = new Set<string>();
	for (const f of raw as Partial<FieldDef>[]) {
		const label = str(f?.label, 200).trim();
		if (!label) continue;
		const kind = FIELD_KINDS.includes(f.kind as FieldKind) ? (f.kind as FieldKind) : 'text';
		let key = str(f.key, 100).trim() || slugify(label).replace(/-/g, '_');
		while (keys.has(key)) key += '_';
		keys.add(key);
		const def: FieldDef = { key, label, kind };
		if (kind === 'select')
			def.options = (Array.isArray(f.options) ? f.options : [])
				.map((o) => str(o, 200).trim())
				.filter(Boolean);
		if (kind === 'element') def.ref = str(f.ref, 100).trim();
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
		let id = str(p.id, 40) || newId();
		while (ids.has(id)) id = newId();
		ids.add(id);
		const title = str(p.title, 200).trim() || 'Panel';
		switch (p.kind as PanelKind) {
			case 'info': {
				const fields = cleanFields(p.fields);
				const values: Record<string, string> = {};
				if (!template && p.values && typeof p.values === 'object') {
					for (const f of fields) {
						const v = str((p.values as Record<string, unknown>)[f.key], 5000).trim();
						if (v) values[f.key] = v;
					}
				}
				out.push({ id, kind: 'info', title, fields, values });
				break;
			}
			case 'text':
				out.push({ id, kind: 'text', title, body: template ? '' : str(p.body, 200000) });
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
									name: str(i?.name, 500).trim(),
									text: str(i?.text, 5000)
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
									name: str(i?.name, 200).trim(),
									value: num(i?.value),
									max: num(i?.max, 0)
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
									elementId: str(i?.elementId, 80),
									note: str(i?.note, 500).trim()
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
									url: str(i?.url, 2000).trim(),
									caption: str(i?.caption, 500).trim()
								}))
								.filter((i) => IMAGE_URL.test(i.url))
				});
				break;
			case 'map': {
				const url = str(p.imageUrl, 2000).trim();
				const seen = new Set<string>();
				out.push({
					id,
					kind: 'map',
					title,
					imageUrl: IMAGE_URL.test(url) ? url : '',
					pins: template
						? []
						: (Array.isArray(p.pins) ? p.pins : [])
								.map((i: Record<string, unknown>) => {
									let pid = str(i?.id, 40) || newId();
									while (seen.has(pid)) pid = newId();
									seen.add(pid);
									const clamp = (v: unknown) => Math.min(1, Math.max(0, num(v, 0.5)));
									const color = str(i?.color, 9).trim();
									return {
										id: pid,
										x: clamp(i?.x),
										y: clamp(i?.y),
										label: str(i?.label, 120).trim(),
										elementId: str(i?.elementId, 80),
										color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#f59e0b'
									};
								})
								.slice(0, 500)
				});
				break;
			}
		}
	}
	return out;
}
