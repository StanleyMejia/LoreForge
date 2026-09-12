import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchWorld } from '$lib/server/repo/search';

/** Top hits for the sidebar search dropdown. */
export const GET: RequestHandler = ({ url, locals }) => {
	const world = locals.world!;
	const q = url.searchParams.get('q')?.trim() ?? '';
	if (q.length < 2) return json([]);
	try {
		return json(
			searchWorld(world.id, q, world.slug, 8).map((h) => ({
				title: h.title,
				href: h.href,
				icon: h.icon,
				subtitle: h.subtitle,
				snippet: h.snippet
			}))
		);
	} catch {
		return json([]);
	}
};
