import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getManuscript, readManuscript, refsByChapter } from '$lib/server/repo/manuscripts';
import { listEvents } from '$lib/server/repo/timeline';
import { makeResolver, renderMarkdown } from '$lib/markdown';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { world, index } = await parent();
	const manuscript = getManuscript(world.id, params.manuscript);
	if (!manuscript) error(404, 'Manuscript not found');
	const ctx = { elementBase: `/w/${world.slug}/e/`, resolve: makeResolver(index) };
	const refs = refsByChapter(manuscript.id);
	const events = new Map(listEvents(world.id).map((e) => [e.id, e]));
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
			event: ev ? { id: ev.id, title: ev.title, dateLabel: ev.dateLabel } : null
		};
	});
	return { manuscript, chapters, total: chapters.reduce((n, c) => n + c.wordCount, 0) };
};
