import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getTypeById } from '$lib/server/repo/worlds';
import { getElement, updateElement } from '$lib/server/repo/elements';
import { readElementInput } from '$lib/server/element-form';
import { str } from '$lib/server/form';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { world } = await parent();
	const element = getElement(world.id, params.element);
	if (!element) error(404, 'Element not found');
	return { element };
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const world = locals.world!;
		const el = getElement(world.id, params.element);
		if (!el) error(404);
		const form = await request.formData();
		const type = getTypeById(str(form, 'typeId') || el.typeId);
		if (!type || type.worldId !== world.id) return fail(400, { error: 'Invalid type.' });
		const input = readElementInput(form);
		if (!input.name) return fail(400, { error: 'Name is required.' });
		const updated = updateElement(
			world.id,
			el.id,
			{ ...input, typeId: type.id },
			locals.user?.id ?? null
		);
		redirect(303, `/w/${world.slug}/e/${updated?.slug ?? el.slug}`);
	}
};
