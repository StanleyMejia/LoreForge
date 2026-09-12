import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTypeById } from '$lib/server/repo/worlds';
import { getElement, getElementsByIds } from '$lib/server/repo/elements';

/**
 * Lightweight "peek" at an element for the chapter editor's reference panel:
 * attributes from info panels (element refs resolved to names) and a short excerpt
 * of the first text panel.
 */
export const GET: RequestHandler = ({ params, locals }) => {
	const world = locals.world!;
	const el = getElement(world.id, params.slug);
	if (!el) error(404);
	const type = getTypeById(el.typeId);

	const refIds: string[] = [];
	for (const p of el.panels)
		if (p.kind === 'info')
			for (const f of p.fields)
				if (f.kind === 'element' && p.values[f.key]) refIds.push(p.values[f.key]);
	const refs = new Map(getElementsByIds(refIds).map((e) => [e.id, e]));

	const attributes: { label: string; value: string }[] = [];
	const lists: { title: string; items: string[] }[] = [];
	let excerpt = '';
	for (const p of el.panels) {
		if (p.kind === 'info') {
			for (const f of p.fields) {
				const raw = p.values[f.key];
				if (!raw) continue;
				attributes.push({
					label: f.label,
					value: f.kind === 'element' ? (refs.get(raw)?.name ?? '') : raw
				});
			}
		} else if (p.kind === 'list' && p.items.length) {
			lists.push({
				title: p.title,
				items: p.items
					.map((i) => i.name || i.text)
					.filter(Boolean)
					.slice(0, 8)
			});
		} else if (p.kind === 'text' && !excerpt && p.body.trim()) {
			excerpt = p.body
				.replace(/[#*_>`[\]]/g, '')
				.replace(/\s+/g, ' ')
				.trim()
				.slice(0, 280);
		}
	}
	return json({
		name: el.name,
		slug: el.slug,
		summary: el.summary,
		imageUrl: el.imageUrl,
		type: type ? { name: type.singular, icon: type.icon, color: type.color } : null,
		tags: el.tags,
		attributes: attributes.filter((a) => a.value).slice(0, 12),
		lists: lists.slice(0, 3),
		excerpt,
		href: `/w/${world.slug}/e/${el.slug}`
	});
};
