import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createWorld, listWorlds } from '$lib/server/repo/worlds';
import { str } from '$lib/server/form';

export const load: PageServerLoad = () => {
	return { worlds: listWorlds() };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const form = await request.formData();
		const name = str(form, 'name').trim();
		if (!name) return fail(400, { error: 'A world needs a name.' });
		const world = createWorld(name, str(form, 'description').trim());
		redirect(303, `/w/${world.slug}`);
	}
};
