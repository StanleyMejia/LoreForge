import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createChapter,
	deleteManuscript,
	getManuscript,
	listChapters,
	manuscriptCast,
	moveChapter,
	refsByChapter,
	updateManuscript
} from '$lib/server/repo/manuscripts';
import { str } from '$lib/server/form';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { world } = await parent();
	const manuscript = getManuscript(world.id, params.manuscript);
	if (!manuscript) error(404, 'Manuscript not found');
	const refs = refsByChapter(manuscript.id);
	const chapters = listChapters(manuscript.id).map((c) => {
		const r = refs.get(c.id) ?? [];
		return {
			...c,
			pov: r.find((x) => x.role === 'pov') ?? null,
			location: r.find((x) => x.role === 'location') ?? null,
			castCount: r.filter((x) => x.role === 'cast').length
		};
	});
	return { manuscript, chapters, cast: manuscriptCast(manuscript.id) };
};

function ctx(locals: App.Locals, manuscriptId: string) {
	const world = locals.world!;
	const manuscript = getManuscript(world.id, manuscriptId);
	if (!manuscript) error(404);
	return { world, manuscript };
}

export const actions: Actions = {
	update: async ({ params, request, locals }) => {
		const { manuscript } = ctx(locals, params.manuscript);
		const form = await request.formData();
		const title = str(form, 'title').trim();
		if (!title) return fail(400, { error: 'Title is required.' });
		updateManuscript(manuscript.id, { title, description: str(form, 'description').trim() });
		return { ok: true };
	},
	addChapter: async ({ params, request, locals }) => {
		const { world, manuscript } = ctx(locals, params.manuscript);
		const form = await request.formData();
		const title = str(form, 'title').trim() || `Chapter ${listChapters(manuscript.id).length + 1}`;
		const ch = createChapter(manuscript.id, title);
		redirect(303, `/w/${world.slug}/m/${manuscript.id}/c/${ch.id}`);
	},
	move: async ({ params, request, locals }) => {
		const { manuscript } = ctx(locals, params.manuscript);
		const form = await request.formData();
		const dir = str(form, 'dir') === 'up' ? 'up' : 'down';
		moveChapter(manuscript.id, str(form, 'id'), dir);
		return { ok: true };
	},
	delete: async ({ params, locals }) => {
		const { world, manuscript } = ctx(locals, params.manuscript);
		deleteManuscript(manuscript.id);
		redirect(303, `/w/${world.slug}/manuscripts`);
	}
};
