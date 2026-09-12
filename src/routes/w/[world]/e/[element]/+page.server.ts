import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getTypeById } from '$lib/server/repo/worlds';
import {
	ancestorTrail,
	backlinks,
	createRelationship,
	deleteElement,
	deleteRelationship,
	getElement,
	getElementById,
	relationshipsFor,
	onMaps
} from '$lib/server/repo/elements';
import { makeResolver, type RenderContext } from '$lib/markdown';
import { prepare } from '$lib/server/view-panels';
import { str } from '$lib/server/form';
import { appearances } from '$lib/server/repo/manuscripts';
import {
	addComment,
	deleteComment,
	listComments,
	setCommentResolved
} from '$lib/server/repo/comments';

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
		trail: ancestorTrail(element.id),
		comments: listComments(world.id, element.id),
		relationships: relationshipsFor(element.id),
		// chapter mentions are shown under "Appears in" instead
		backlinks: backlinks(world.slug, element.id).filter((b) => b.kind !== 'chapter'),
		onMaps: onMaps(element.id),
		appearances: appearances(element.id)
	};
};

export const actions: Actions = {
	// All three are POSTs, so hooks.server.ts already limits them to editors and owners.
	comment: async ({ params, request, locals }) => {
		const world = locals.world!;
		const el = getElement(world.id, params.element);
		if (!el) error(404);
		const form = await request.formData();
		const body = str(form, 'body').trim().slice(0, 4000);
		const panelId = str(form, 'panelId');
		if (!body) return fail(400, { commentError: 'Write something first.' });
		if (!el.panels.some((p) => p.id === panelId))
			return fail(400, { commentError: 'That panel is gone.' });
		addComment({
			worldId: world.id,
			elementId: el.id,
			panelId,
			body,
			authorId: locals.user?.id ?? null
		});
		return { ok: true };
	},
	resolveComment: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		setCommentResolved(world.id, str(form, 'id'), str(form, 'resolved') !== 'false');
		return { ok: true };
	},
	deleteComment: async ({ request, locals }) => {
		const world = locals.world!;
		deleteComment(world.id, str(await request.formData(), 'id'));
		return { ok: true };
	},
	delete: async ({ params, locals }) => {
		const world = locals.world!;
		const el = getElement(world.id, params.element);
		if (!el) error(404);
		const type = getTypeById(el.typeId);
		deleteElement(el.id);
		redirect(303, `/w/${world.slug}/t/${type?.key ?? ''}`);
	},
	addRelationship: async ({ params, request, locals }) => {
		const world = locals.world!;
		const el = getElement(world.id, params.element);
		if (!el) error(404);
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
	removeRelationship: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		deleteRelationship(str(form, 'id'));
		return { ok: true };
	}
};
