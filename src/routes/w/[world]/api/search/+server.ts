import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getWorldBySlug } from '$lib/server/repo/worlds';
import { searchWorld } from '$lib/server/repo/search';

/** Top hits for the sidebar search dropdown. */
export const GET: RequestHandler = ({ params, url }) => {
	const world = getWorldBySlug(params.world);
	if (!world) error(404);
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
