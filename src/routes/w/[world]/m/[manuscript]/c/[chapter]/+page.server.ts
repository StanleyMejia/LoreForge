import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getWorldBySlug } from '$lib/server/repo/worlds';
import {
	chapterNeighbours,
	deleteChapter,
	getChapter,
	getManuscript,
	updateChapter
} from '$lib/server/repo/manuscripts';
import { str } from '$lib/server/form';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { world } = await parent();
	const manuscript = getManuscript(world.id, params.manuscript);
	if (!manuscript) error(404, 'Manuscript not found');
	const chapter = getChapter(manuscript.id, params.chapter);
	if (!chapter) error(404, 'Chapter not found');
	return { manuscript, chapter, nav: chapterNeighbours(manuscript.id, chapter.id) };
};

function ctx(params: { world: string; manuscript: string; chapter: string }) {
	const world = getWorldBySlug(params.world);
	const manuscript = world && getManuscript(world.id, params.manuscript);
	const chapter = manuscript && getChapter(manuscript.id, params.chapter);
	if (!world || !manuscript || !chapter) error(404);
	return { world, manuscript, chapter };
}

export const actions: Actions = {
	save: async ({ params, request }) => {
		const { world, manuscript, chapter } = ctx(params);
		const form = await request.formData();
		const title = str(form, 'title').trim();
		if (!title) return fail(400, { error: 'Title is required.' });
		updateChapter(world.id, manuscript.id, chapter.id, {
			title,
			synopsis: str(form, 'synopsis').trim(),
			body: str(form, 'body'),
			status: str(form, 'status')
		});
		return { saved: Date.now() };
	},
	delete: async ({ params }) => {
		const { world, manuscript, chapter } = ctx(params);
		deleteChapter(manuscript.id, chapter.id);
		redirect(303, `/w/${world.slug}/m/${manuscript.id}`);
	}
};
