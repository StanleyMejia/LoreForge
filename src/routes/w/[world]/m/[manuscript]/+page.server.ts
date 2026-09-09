import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getWorldBySlug } from '$lib/server/repo/worlds';
import {
	createChapter,
	deleteManuscript,
	getManuscript,
	listChapters,
	moveChapter,
	updateManuscript
} from '$lib/server/repo/manuscripts';
import { str } from '$lib/server/form';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { world } = await parent();
	const manuscript = getManuscript(world.id, params.manuscript);
	if (!manuscript) error(404, 'Manuscript not found');
	return { manuscript, chapters: listChapters(manuscript.id) };
};

function ctx(params: { world: string; manuscript: string }) {
	const world = getWorldBySlug(params.world);
	const manuscript = world && getManuscript(world.id, params.manuscript);
	if (!world || !manuscript) error(404);
	return { world, manuscript };
}

export const actions: Actions = {
	update: async ({ params, request }) => {
		const { manuscript } = ctx(params);
		const form = await request.formData();
		const title = str(form, 'title').trim();
		if (!title) return fail(400, { error: 'Title is required.' });
		updateManuscript(manuscript.id, { title, description: str(form, 'description').trim() });
		return { ok: true };
	},
	addChapter: async ({ params, request }) => {
		const { world, manuscript } = ctx(params);
		const form = await request.formData();
		const title = str(form, 'title').trim() || `Chapter ${listChapters(manuscript.id).length + 1}`;
		const ch = createChapter(manuscript.id, title);
		redirect(303, `/w/${world.slug}/m/${manuscript.id}/c/${ch.id}`);
	},
	move: async ({ params, request }) => {
		const { manuscript } = ctx(params);
		const form = await request.formData();
		const dir = str(form, 'dir') === 'up' ? 'up' : 'down';
		moveChapter(manuscript.id, str(form, 'id'), dir);
		return { ok: true };
	},
	delete: async ({ params }) => {
		const { world, manuscript } = ctx(params);
		deleteManuscript(manuscript.id);
		redirect(303, `/w/${world.slug}/manuscripts`);
	}
};
