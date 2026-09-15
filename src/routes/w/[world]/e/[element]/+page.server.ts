import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getTypeById } from '$lib/server/repo/worlds';
import {
	ancestorTrail,
	backlinks,
	childrenOf,
	referencedBy,
	createRelationship,
	deleteElement,
	deleteRelationship,
	getElement,
	getElementById,
	relationshipsFor,
	moveChild,
	onMaps,
	updateRelationship
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
import { canEdit } from '$lib/server/repo/members';

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
		children: childrenOf(world.id, element.id),
		referencedBy: referencedBy(world.id, element.id),
		comments: listComments(world.id, element.id),
		relationships: relationshipsFor(element.id),
		// chapter mentions are shown under "Appears in" instead
		backlinks: backlinks(world.slug, element.id).filter((b) => b.kind !== 'chapter'),
		onMaps: onMaps(element.id),
		appearances: appearances(element.id)
	};
};

export const actions: Actions = {
	// Every action is a POST, so hooks.server.ts already limits them to editors and owners — except
	// `comment` and `deleteComment`, which viewers may also use (see viewerMayPost).
	comment: async ({ params, request, locals }) => {
		const world = locals.world!;
		const el = getElement(world.id, params.element);
		if (!el) error(404);
		const form = await request.formData();
		const body = str(form, 'body').trim().slice(0, 4000);
		const panelId = str(form, 'panelId');
		const parentId = str(form, 'parentId') || null;
		if (!body) return fail(400, { commentError: 'Write something first.' });
		// A reply takes its thread's panel, so only a new thread names one.
		if (!parentId && !el.panels.some((p) => p.id === panelId))
			return fail(400, { commentError: 'That panel is gone.' });
		const added = addComment({
			worldId: world.id,
			elementId: el.id,
			panelId,
			parentId,
			body,
			authorId: locals.user?.id ?? null
		});
		if (!added) return fail(400, { commentError: 'That thread is gone.' });
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
		const id = str(await request.formData(), 'id');
		deleteComment(world.id, id, canEdit(world.role) ? undefined : (locals.user?.id ?? ''));
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
	editRelationship: async ({ params, request, locals }) => {
		const world = locals.world!;
		const el = getElement(world.id, params.element);
		if (!el) error(404);
		const form = await request.formData();
		const id = str(form, 'id');
		const label = str(form, 'label').trim();
		if (!label) return fail(400, { relEditError: 'Give the relationship a label.', relId: id });
		const otherId = str(form, 'otherId');
		if (otherId) {
			const other = getElementById(otherId);
			if (!other || other.worldId !== world.id)
				return fail(400, { relEditError: 'Pick an element.', relId: id });
			if (other.id === el.id)
				return fail(400, { relEditError: 'An element cannot relate to itself.', relId: id });
		}
		const ok = updateRelationship(world.id, el.id, id, {
			label,
			reverseLabel: str(form, 'reverseLabel').trim(),
			notes: str(form, 'notes').trim(),
			swap: form.get('swap') === 'on',
			otherId: otherId || undefined
		});
		if (!ok) error(404, 'Relationship not found');
		return { ok: true };
	},
	moveChild: async ({ params, request, locals }) => {
		const world = locals.world!;
		const el = getElement(world.id, params.element);
		if (!el) error(404);
		const form = await request.formData();
		const child = getElementById(str(form, 'id'));
		// Only this element's own children can be reordered from its page.
		if (!child || child.worldId !== world.id || child.parentId !== el.id) error(404);
		moveChild(world.id, child.id, str(form, 'dir') === 'up' ? 'up' : 'down');
		return { ok: true };
	},
	removeRelationship: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		deleteRelationship(world.id, str(form, 'id'));
		return { ok: true };
	}
};
