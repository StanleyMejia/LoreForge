import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getElement, updateElement } from '$lib/server/repo/elements';
import { getTypeById } from '$lib/server/repo/worlds';
import { getRevision, listRevisions, saveRevision } from '$lib/server/repo/revisions';
import { cleanPanels } from '$lib/server/panels';
import { prepare } from '$lib/server/view-panels';
import { makeResolver } from '$lib/markdown';
import { str } from '$lib/server/form';
import { str as coerce } from '$lib/server/coerce';

/**
 * The element fields a revision carries; `title` (the name) lives on the revision row.
 * Panels are re-cleaned rather than trusted: the type's field definitions may have moved
 * on since, and a stored panel array is only as valid as the schema it was written against.
 */
function readContent(raw: string) {
	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		parsed = {};
	}
	return {
		summary: coerce(parsed.summary, 2000),
		panels: cleanPanels(parsed.panels),
		tags: (Array.isArray(parsed.tags) ? parsed.tags : [])
			.map((t) => coerce(t, 60).trim())
			.filter(Boolean),
		imageUrl: coerce(parsed.imageUrl, 2000),
		typeId: coerce(parsed.typeId, 80),
		// Older revisions predate containment and simply have no parent recorded.
		parentId: coerce(parsed.parentId, 80) || null
	};
}

export const load: PageServerLoad = async ({ params, url, parent }) => {
	const { world, index } = await parent();
	const element = getElement(world.id, params.element);
	if (!element) error(404, 'Element not found');
	const revisions = listRevisions(world.id, 'element', element.id);

	const wanted = url.searchParams.get('rev');
	const row = wanted ? getRevision(world.id, wanted) : undefined;
	const hit = row && row.kind === 'element' && row.docId === element.id ? row : undefined;
	const content = hit ? readContent(hit.content) : null;

	return {
		element: { id: element.id, slug: element.slug, name: element.name },
		revisions: revisions.map((r, i) => ({
			...r,
			delta: r.bytes - (revisions[i + 1]?.bytes ?? r.bytes)
		})),
		shown:
			hit && content
				? {
						id: hit.id,
						title: hit.title,
						createdAt: hit.createdAt,
						summary: content.summary,
						panels: prepare(content.panels, world.slug, {
							elementBase: `/w/${world.slug}/e/`,
							resolve: makeResolver(index)
						})
					}
				: null
	};
};

export const actions: Actions = {
	// POST, so hooks.server.ts refuses it for viewers without a check of its own.
	restore: async ({ params, request, locals }) => {
		const world = locals.world!;
		const el = getElement(world.id, params.element);
		if (!el) error(404);
		const form = await request.formData();
		const row = getRevision(world.id, str(form, 'id'));
		if (!row || row.kind !== 'element' || row.docId !== el.id) error(404);
		const content = readContent(row.content);
		// Snapshot what the restore is about to replace, bypassing the coalescing window: a
		// restore is destructive on purpose, and it is most often done moments after editing.
		saveRevision({
			worldId: world.id,
			kind: 'element',
			docId: el.id,
			title: el.name,
			authorId: locals.user?.id ?? null,
			content: JSON.stringify({
				summary: el.summary,
				panels: el.panels,
				tags: el.tags,
				imageUrl: el.imageUrl,
				typeId: el.typeId,
				parentId: el.parentId
			})
		});
		// The stored type may have been deleted since; keep the element where it is.
		const type = getTypeById(content.typeId);
		const updated = updateElement(
			world.id,
			el.id,
			{
				...content,
				name: row.title || el.name,
				typeId: type && type.worldId === world.id ? type.id : el.typeId
			},
			locals.user?.id ?? null
		);
		redirect(303, `/w/${world.slug}/e/${updated?.slug ?? el.slug}`);
	}
};
