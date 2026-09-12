import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createManuscript, listManuscripts } from '$lib/server/repo/manuscripts';
import { str } from '$lib/server/form';

export const load: PageServerLoad = async ({ parent }) => {
	const { world } = await parent();
	return { manuscripts: listManuscripts(world.id) };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		const title = str(form, 'title').trim();
		if (!title) return fail(400, { error: 'Title is required.' });
		const m = createManuscript(world.id, title, str(form, 'description').trim());
		redirect(303, `/w/${world.slug}/m/${m.id}`);
	}
};
