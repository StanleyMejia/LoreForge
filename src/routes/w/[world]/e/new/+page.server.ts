import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getType, getTypeById, listTypes } from '$lib/server/repo/worlds';
import { createElement, parentProblem } from '$lib/server/repo/elements';
import { readElementInput } from '$lib/server/element-form';
import { str } from '$lib/server/form';

export const load: PageServerLoad = async ({ url, parent }) => {
	const { world, types } = await parent();
	const wanted = url.searchParams.get('type');
	const type = (wanted && getType(world.id, wanted)) || types[0];
	if (!type) error(400, 'This world has no element types. Add one in settings first.');
	return { typeId: type.id, initialName: url.searchParams.get('name') ?? '' };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		const type = getTypeById(str(form, 'typeId')) ?? listTypes(world.id)[0];
		if (!type || type.worldId !== world.id) return fail(400, { error: 'Invalid type.' });
		const input = readElementInput(form);
		if (!input.name) return fail(400, { error: 'Name is required.' });
		const problem = parentProblem(world.id, null, input.parentId ?? null);
		if (problem) return fail(400, { error: problem });
		const el = createElement(world.id, type.id, input);
		redirect(303, `/w/${world.slug}/e/${el.slug}`);
	}
};
