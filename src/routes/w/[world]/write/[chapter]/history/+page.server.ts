import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getChapterInWorld, updateChapter } from '$lib/server/repo/manuscripts';
import { getRevision, listRevisions, saveRevision } from '$lib/server/repo/revisions';
import { getEvent } from '$lib/server/repo/timeline';
import { makeResolver, renderMarkdown } from '$lib/markdown';
import { diffBlocks } from '$lib/diff';
import { str } from '$lib/server/form';
import { str as coerce } from '$lib/server/coerce';

/** The chapter fields a revision carries; `title` lives on the revision row itself. */
function readContent(raw: string) {
	let parsed: Record<string, unknown>;
	try {
		parsed = JSON.parse(raw) as Record<string, unknown>;
	} catch {
		parsed = {};
	}
	return {
		synopsis: coerce(parsed.synopsis, 2000),
		body: coerce(parsed.body, 2_000_000),
		status: coerce(parsed.status, 20),
		eventId: coerce(parsed.eventId, 80) || null
	};
}

export const load: PageServerLoad = async ({ params, url, parent }) => {
	const { world, index } = await parent();
	const chapter = getChapterInWorld(world.id, params.chapter);
	if (!chapter) error(404, 'Chapter not found');
	const revisions = listRevisions(world.id, 'chapter', chapter.id);

	const wanted = url.searchParams.get('rev');
	const row = wanted ? getRevision(world.id, wanted) : undefined;
	const shown =
		row && row.kind === 'chapter' && row.docId === chapter.id
			? {
					id: row.id,
					title: row.title,
					createdAt: row.createdAt,
					...readContent(row.content)
				}
			: null;

	// `vs` turns the view into a comparison: against the live text, or against another version.
	const vs = url.searchParams.get('vs');
	const other =
		!shown || !vs
			? null
			: vs === 'current'
				? { body: chapter.body, at: chapter.updatedAt, current: true }
				: (() => {
						const r = getRevision(world.id, vs);
						if (!r || r.kind !== 'chapter' || r.docId !== chapter.id) return null;
						return { body: readContent(r.content).body, at: r.createdAt, current: false };
					})();

	return {
		chapter: { id: chapter.id, manuscriptId: chapter.manuscriptId, title: chapter.title },
		diff:
			shown && other
				? { blocks: diffBlocks(shown.body, other.body), at: other.at, current: other.current }
				: null,
		// Sizes come back as bytes; the list shows each revision's change against the next older one.
		revisions: revisions.map((r, i) => ({
			...r,
			delta: r.bytes - (revisions[i + 1]?.bytes ?? r.bytes),
			// The list is newest first, so the next entry is the version before this one.
			prevId: revisions[i + 1]?.id ?? null
		})),
		shown: shown && {
			...shown,
			html: renderMarkdown(shown.body, {
				elementBase: `/w/${world.slug}/e/`,
				resolve: makeResolver(index)
			})
		}
	};
};

export const actions: Actions = {
	// POST, so hooks.server.ts refuses it for viewers without a check of its own.
	restore: async ({ params, request, locals }) => {
		const world = locals.world!;
		const chapter = getChapterInWorld(world.id, params.chapter);
		if (!chapter) error(404);
		const form = await request.formData();
		const row = getRevision(world.id, str(form, 'id'));
		if (!row || row.kind !== 'chapter' || row.docId !== chapter.id) error(404);
		const content = readContent(row.content);
		// Snapshot what the restore is about to replace, bypassing the coalescing window: a
		// restore is destructive on purpose, and it is most often done moments after editing.
		saveRevision({
			worldId: world.id,
			kind: 'chapter',
			docId: chapter.id,
			title: chapter.title,
			authorId: locals.user?.id ?? null,
			content: JSON.stringify({
				synopsis: chapter.synopsis,
				body: chapter.body,
				status: chapter.status,
				eventId: chapter.eventId
			})
		});
		updateChapter(
			world.id,
			chapter.manuscriptId,
			chapter.id,
			{
				title: row.title || chapter.title,
				...content,
				// The event may have been deleted since; a stale id would break the foreign key.
				eventId: content.eventId && getEvent(world.id, content.eventId) ? content.eventId : null
			},
			locals.user?.id ?? null
		);
		redirect(303, `/w/${world.slug}/write/${chapter.id}`);
	}
};
