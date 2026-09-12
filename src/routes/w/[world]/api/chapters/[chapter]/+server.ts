import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getChapterInWorld,
	setChapterRefs,
	updateChapter,
	type RefInput
} from '$lib/server/repo/manuscripts';
import { getEvent } from '$lib/server/repo/timeline';
import { saveRevision } from '$lib/server/repo/revisions';
import { CHAPTER_ROLES, type ChapterRole } from '$lib/types';
import { str } from '$lib/server/coerce';

/**
 * Autosave endpoint for the writing workspace. Access control (membership, editor role)
 * is enforced by hooks.server.ts; this adds an Origin check against CSRF.
 */
export const PUT: RequestHandler = async ({ params, request, url, locals }) => {
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Cross-origin request rejected');
	const world = locals.world!;
	const chapter = getChapterInWorld(world.id, params.chapter);
	if (!chapter) error(404);

	let payload: Record<string, unknown>;
	try {
		payload = await request.json();
	} catch {
		error(400, 'Invalid JSON');
	}
	const title = str(payload.title, 300).trim();
	if (!title) error(400, 'Title is required');
	const eventId = str(payload.eventId, 80);
	const saved = updateChapter(
		world.id,
		chapter.manuscriptId,
		chapter.id,
		{
			title,
			synopsis: str(payload.synopsis, 2000).trim(),
			body: str(payload.body, 2_000_000),
			status: str(payload.status, 20),
			eventId: eventId && getEvent(world.id, eventId) ? eventId : null
		},
		locals.user?.id ?? null
	);
	const refs: RefInput[] = (Array.isArray(payload.refs) ? payload.refs : [])
		.map((r: Record<string, unknown>) => ({
			elementId: str(r?.elementId, 80),
			role: str(r?.role, 20) as ChapterRole,
			note: str(r?.note, 500)
		}))
		.filter((r) => r.elementId && (CHAPTER_ROLES as readonly string[]).includes(r.role));
	setChapterRefs(world.id, chapter.id, refs);
	// An explicit keep pins the version the writer is looking at, so it is taken after the
	// update rather than as a pre-image, and it is exempt from pruning.
	if (payload.keep && saved)
		saveRevision({
			worldId: world.id,
			kind: 'chapter',
			docId: chapter.id,
			title: saved.title,
			authorId: locals.user?.id ?? null,
			label: 'kept',
			content: JSON.stringify({
				synopsis: saved.synopsis,
				body: saved.body,
				status: saved.status,
				eventId: saved.eventId
			})
		});
	return json({ savedAt: Date.now(), wordCount: saved?.wordCount ?? 0 });
};
