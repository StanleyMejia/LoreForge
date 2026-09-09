import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getTypeById, getWorldBySlug } from '$lib/server/repo/worlds';
import {
	backlinks,
	createRelationship,
	deleteElement,
	deleteRelationship,
	getElement,
	getElementById,
	getElementsByIds,
	relationshipsFor
} from '$lib/server/repo/elements';
import { makeResolver, renderMarkdown, type RenderContext } from '$lib/markdown';
import { str } from '$lib/server/form';
import type { Panel } from '$lib/types';

/** A panel prepared for display: markdown rendered, element refs resolved. */
export type ViewPanel =
	| {
			id: string;
			kind: 'info';
			title: string;
			rows: {
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
	| { id: string; kind: 'gallery'; title: string; images: { url: string; caption: string }[] };

function prepare(panels: Panel[], worldSlug: string, ctx: RenderContext): ViewPanel[] {
	const refIds = new Set<string>();
	for (const p of panels) {
		if (p.kind === 'info')
			for (const f of p.fields)
				if (f.kind === 'element' && p.values[f.key]) refIds.add(p.values[f.key]);
		if (p.kind === 'links') for (const l of p.links) refIds.add(l.elementId);
	}
	const refs = new Map(getElementsByIds([...refIds]).map((e) => [e.id, e]));
	const out: ViewPanel[] = [];
	for (const p of panels) {
		switch (p.kind) {
			case 'info': {
				const rows = [];
				for (const f of p.fields) {
					const raw = p.values[f.key];
					if (!raw) continue;
					if (f.kind === 'element') {
						const r = refs.get(raw);
						if (r)
							rows.push({
								label: f.label,
								kind: f.kind,
								value: r.name,
								href: `/w/${worldSlug}/e/${r.slug}`,
								icon: r.typeIcon
							});
					} else rows.push({ label: f.label, kind: f.kind, value: raw, href: null, icon: null });
				}
				if (rows.length) out.push({ id: p.id, kind: 'info', title: p.title, rows });
				break;
			}
			case 'text':
				if (p.body.trim())
					out.push({ id: p.id, kind: 'text', title: p.title, html: renderMarkdown(p.body, ctx) });
				break;
			case 'list':
				if (p.items.length)
					out.push({
						id: p.id,
						kind: 'list',
						title: p.title,
						items: p.items.map((i) => ({ name: i.name, html: renderMarkdown(i.text, ctx) }))
					});
				break;
			case 'stats':
				if (p.stats.length) out.push({ id: p.id, kind: 'stats', title: p.title, stats: p.stats });
				break;
			case 'links': {
				const links = p.links
					.map((l) => {
						const r = refs.get(l.elementId);
						return r
							? { name: r.name, slug: r.slug, icon: r.typeIcon, typeName: r.typeName, note: l.note }
							: null;
					})
					.filter((l) => l !== null);
				if (links.length) out.push({ id: p.id, kind: 'links', title: p.title, links });
				break;
			}
			case 'gallery':
				if (p.images.length)
					out.push({ id: p.id, kind: 'gallery', title: p.title, images: p.images });
				break;
		}
	}
	return out;
}

export const load: PageServerLoad = async ({ params, parent }) => {
	const { world, index } = await parent();
	const element = getElement(world.id, params.element);
	if (!element) error(404, 'Element not found');
	const type = getTypeById(element.typeId);
	if (!type) error(500, 'Element type missing');
	const ctx: RenderContext = { elementBase: `/w/${world.slug}/e/`, resolve: makeResolver(index) };
	return {
		element,
		type,
		panels: prepare(element.panels, world.slug, ctx),
		relationships: relationshipsFor(element.id),
		backlinks: backlinks(world.slug, element.id)
	};
};

export const actions: Actions = {
	delete: async ({ params }) => {
		const world = getWorldBySlug(params.world);
		const el = world && getElement(world.id, params.element);
		if (!world || !el) error(404);
		const type = getTypeById(el.typeId);
		deleteElement(el.id);
		redirect(303, `/w/${world.slug}/t/${type?.key ?? ''}`);
	},
	addRelationship: async ({ params, request }) => {
		const world = getWorldBySlug(params.world);
		const el = world && getElement(world.id, params.element);
		if (!world || !el) error(404);
		const form = await request.formData();
		const toId = str(form, 'toId');
		const label = str(form, 'label').trim();
		const target = getElementById(toId);
		if (!target || target.worldId !== world.id) return fail(400, { relError: 'Pick an element.' });
		if (target.id === el.id) return fail(400, { relError: 'An element cannot relate to itself.' });
		if (!label) return fail(400, { relError: 'Give the relationship a label.' });
		createRelationship(world.id, {
			fromId: el.id,
			toId,
			label,
			reverseLabel: str(form, 'reverseLabel').trim(),
			notes: str(form, 'notes').trim()
		});
		return { ok: true };
	},
	removeRelationship: async ({ params, request }) => {
		const world = getWorldBySlug(params.world);
		if (!world) error(404);
		const form = await request.formData();
		deleteRelationship(str(form, 'id'));
		return { ok: true };
	}
};
