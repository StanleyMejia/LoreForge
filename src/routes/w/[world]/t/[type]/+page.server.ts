import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getType, getWorldBySlug } from '$lib/server/repo/worlds';
import { createElement, listElements } from '$lib/server/repo/elements';
import { str } from '$lib/server/form';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { world } = await parent();
	const type = getType(world.id, params.type);
	if (!type) error(404, 'Unknown element type');
	return { type, elements: listElements(world.id, type.id) };
};

export const actions: Actions = {
	quickAdd: async ({ request, params }) => {
		const world = getWorldBySlug(params.world);
		const type = world && getType(world.id, params.type);
		if (!world || !type) error(404);
		const form = await request.formData();
		const name = str(form, 'name').trim();
		if (!name) return fail(400, { error: 'Name is required.' });
		const el = createElement(world.id, type.id, { name });
		redirect(303, `/w/${world.slug}/e/${el.slug}/edit`);
	}
};
