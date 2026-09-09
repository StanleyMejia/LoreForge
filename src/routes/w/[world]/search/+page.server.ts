import type { PageServerLoad } from './$types';
import { elementsByTag, searchElements } from '$lib/server/repo/elements';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { world } = await parent();
	const q = url.searchParams.get('q')?.trim() ?? '';
	const tag = url.searchParams.get('tag')?.trim() ?? '';
	const results = tag ? elementsByTag(world.id, tag) : q ? searchElements(world.id, q) : [];
	return { q, tag, results };
};
