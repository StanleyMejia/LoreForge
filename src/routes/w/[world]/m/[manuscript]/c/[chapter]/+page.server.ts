import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getWorldBySlug } from '$lib/server/repo/worlds';
import {
	chapterNeighbours,
	chapterRefsFor,
	deleteChapter,
	getChapter,
	getManuscript,
	setChapterRefs,
	updateChapter,
	type RefInput
} from '$lib/server/repo/manuscripts';
import { getEvent, listEvents } from '$lib/server/repo/timeline';
import { parseJson, str } from '$lib/server/form';
import { CHAPTER_ROLES, type ChapterRole } from '$lib/types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { world } = await parent();
	const manuscript = getManuscript(world.id, params.manuscript);
	if (!manuscript) error(404, 'Manuscript not found');
	const chapter = getChapter(manuscript.id, params.chapter);
	if (!chapter) error(404, 'Chapter not found');
	return {
		manuscript,
		chapter,
		nav: chapterNeighbours(manuscript.id, chapter.id),
		refs: chapterRefsFor(chapter.id),
		events: listEvents(world.id).map((e) => ({ id: e.id, title: e.title, dateLabel: e.dateLabel }))
	};
};

function ctx(params: { world: string; manuscript: string; chapter: string }) {
	const world = getWorldBySlug(params.world);
	const manuscript = world && getManuscript(world.id, params.manuscript);
	const chapter = manuscript && getChapter(manuscript.id, params.chapter);
	if (!world || !manuscript || !chapter) error(404);
	return { world, manuscript, chapter };
}

function readRefs(raw: unknown): RefInput[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.map((r: Record<string, unknown>) => ({
			elementId: typeof r?.elementId === 'string' ? r.elementId : '',
			role: r?.role as ChapterRole,
			note: typeof r?.note === 'string' ? r.note.slice(0, 500) : ''
		}))
		.filter((r) => r.elementId && (CHAPTER_ROLES as readonly string[]).includes(r.role));
}

export const actions: Actions = {
	save: async ({ params, request }) => {
		const { world, manuscript, chapter } = ctx(params);
		const form = await request.formData();
		const title = str(form, 'title').trim();
		if (!title) return fail(400, { error: 'Title is required.' });
		const eventId = str(form, 'eventId');
		updateChapter(world.id, manuscript.id, chapter.id, {
			title,
			synopsis: str(form, 'synopsis').trim(),
			body: str(form, 'body'),
			status: str(form, 'status'),
			eventId: eventId && getEvent(world.id, eventId) ? eventId : null
		});
		setChapterRefs(world.id, chapter.id, readRefs(parseJson(str(form, 'refs'), [])));
		return { saved: Date.now() };
	},
	delete: async ({ params }) => {
		const { world, manuscript, chapter } = ctx(params);
		deleteChapter(manuscript.id, chapter.id);
		redirect(303, `/w/${world.slug}/m/${manuscript.id}`);
	}
};
