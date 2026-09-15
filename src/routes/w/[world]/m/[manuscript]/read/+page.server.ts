import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getChapterInWorld,
	getManuscript,
	readManuscript,
	refsByChapter
} from '$lib/server/repo/manuscripts';
import { listEvents } from '$lib/server/repo/timeline';
import { addComment, commentsByChapter, deleteComment } from '$lib/server/repo/comments';
import { canEdit } from '$lib/server/repo/members';
import { makeResolver, renderMarkdown } from '$lib/markdown';
import { str } from '$lib/server/form';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { world, index } = await parent();
	const manuscript = getManuscript(world.id, params.manuscript);
	if (!manuscript) error(404, 'Manuscript not found');
	const ctx = { elementBase: `/w/${world.slug}/e/`, resolve: makeResolver(index) };
	const refs = refsByChapter(manuscript.id);
	const events = new Map(listEvents(world.id).map((e) => [e.id, e]));
	const comments = commentsByChapter(world.id, manuscript.id);
	const chapters = readManuscript(manuscript.id).map((c, i) => {
		const r = refs.get(c.id) ?? [];
		const ev = c.eventId ? events.get(c.eventId) : undefined;
		return {
			id: c.id,
			index: i + 1,
			title: c.title,
			synopsis: c.synopsis,
			status: c.status,
			wordCount: c.wordCount,
			html: renderMarkdown(c.body, ctx),
			pov: r.find((x) => x.role === 'pov') ?? null,
			location: r.find((x) => x.role === 'location') ?? null,
			event: ev ? { id: ev.id, title: ev.title, dateLabel: ev.dateLabel } : null,
			comments: comments.get(c.id) ?? []
		};
	});
	return { manuscript, chapters, total: chapters.reduce((n, c) => n + c.wordCount, 0) };
};

// The read-through is where viewers land instead of the chapter editor, so it is where they
// comment on chapters. hooks.server.ts lets viewers reach these two actions and nothing else.
export const actions: Actions = {
	comment: async ({ params, request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		const chapter = getChapterInWorld(world.id, str(form, 'chapterId'));
		if (!chapter || chapter.manuscriptId !== params.manuscript)
			return fail(400, { commentError: 'That chapter is gone.' });
		const body = str(form, 'body').trim().slice(0, 4000);
		if (!body) return fail(400, { commentError: 'Write something first.' });
		const added = addComment({
			worldId: world.id,
			chapterId: chapter.id,
			parentId: str(form, 'parentId') || null,
			body,
			authorId: locals.user?.id ?? null
		});
		if (!added) return fail(400, { commentError: 'That thread is gone.' });
		return { ok: true };
	},
	deleteComment: async ({ request, locals }) => {
		const world = locals.world!;
		const id = str(await request.formData(), 'id');
		deleteComment(world.id, id, canEdit(world.role) ? undefined : (locals.user?.id ?? ''));
		return { ok: true };
	}
};
