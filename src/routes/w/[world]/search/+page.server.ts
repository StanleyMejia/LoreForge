import type { PageServerLoad } from './$types';
import { elementsByTag } from '$lib/server/repo/elements';
import { searchWorld, type SearchHit } from '$lib/server/repo/search';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { world } = await parent();
	const q = url.searchParams.get('q')?.trim() ?? '';
	const tag = url.searchParams.get('tag')?.trim() ?? '';
	if (tag) return { q, tag, hits: [] as SearchHit[], tagged: elementsByTag(world.id, tag) };
	if (!q) return { q, tag, hits: [] as SearchHit[], tagged: [] };
	return { q, tag, hits: searchWorld(world.id, q, world.slug), tagged: [] };
};
