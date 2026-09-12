import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	binder,
	chapterRefsFor,
	createChapter,
	createManuscript,
	deleteChapter,
	getChapterInWorld,
	getManuscript,
	moveChapter
} from '$lib/server/repo/manuscripts';
import { listEvents } from '$lib/server/repo/timeline';
import { str } from '$lib/server/form';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { world } = await parent();
	const chapter = getChapterInWorld(world.id, params.chapter);
	if (!chapter) error(404, 'Chapter not found');
	return {
		chapter,
		binder: binder(world.id),
		refs: chapterRefsFor(chapter.id),
		events: listEvents(world.id).map((e) => ({ id: e.id, title: e.title, dateLabel: e.dateLabel }))
	};
};

function ctx(locals: App.Locals, chapterId: string) {
	const world = locals.world!;
	const chapter = getChapterInWorld(world.id, chapterId);
	if (!chapter) error(404);
	return { world, chapter };
}

export const actions: Actions = {
	/** New chapter in a manuscript of this world (defaults to the current one). */
	addChapter: async ({ params, request, locals }) => {
		const { world, chapter } = ctx(locals, params.chapter);
		const form = await request.formData();
		const manuscriptId = str(form, 'manuscriptId') || chapter.manuscriptId;
		const m = getManuscript(world.id, manuscriptId);
		if (!m) error(404);
		const c = createChapter(
			m.id,
			str(form, 'title').trim() ||
				`Chapter ${binder(world.id).find((b) => b.id === m.id)!.chapters.length + 1}`
		);
		redirect(303, `/w/${world.slug}/write/${c.id}`);
	},
	addManuscript: async ({ params, request, locals }) => {
		const { world } = ctx(locals, params.chapter);
		const form = await request.formData();
		const title = str(form, 'title').trim();
		if (!title) return fail(400, { error: 'Give the manuscript a title.' });
		const m = createManuscript(world.id, title);
		const c = createChapter(m.id, 'Chapter 1');
		redirect(303, `/w/${world.slug}/write/${c.id}`);
	},
	move: async ({ params, request, locals }) => {
		const { chapter } = ctx(locals, params.chapter);
		const form = await request.formData();
		moveChapter(chapter.manuscriptId, chapter.id, str(form, 'dir') === 'up' ? 'up' : 'down');
		return { ok: true };
	},
	delete: async ({ params, locals }) => {
		const { world, chapter } = ctx(locals, params.chapter);
		deleteChapter(chapter.manuscriptId, chapter.id);
		redirect(303, `/w/${world.slug}/write`);
	}
};
