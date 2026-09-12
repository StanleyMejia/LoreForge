import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createChapter, createManuscript, latestChapter } from '$lib/server/repo/manuscripts';
import { str } from '$lib/server/form';

/** Entry point of the writing workspace: jump to the last edited chapter, or offer to start. */
export const load: PageServerLoad = async ({ parent }) => {
	const { world } = await parent();
	const latest = latestChapter(world.id);
	if (latest) redirect(303, `/w/${world.slug}/write/${latest.id}`);
	return {};
};

export const actions: Actions = {
	start: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		const title = str(form, 'title').trim() || 'Untitled manuscript';
		const m = createManuscript(world.id, title);
		const c = createChapter(m.id, str(form, 'chapter').trim() || 'Chapter 1');
		redirect(303, `/w/${world.slug}/write/${c.id}`);
	}
};
