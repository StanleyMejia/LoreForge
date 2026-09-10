import type { PageServerLoad } from './$types';
import { elementsByTag, searchElements } from '$lib/server/repo/elements';
import { searchChapters } from '$lib/server/repo/manuscripts';
import { searchWorld, type SearchHit } from '$lib/server/repo/search';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { world } = await parent();
	const q = url.searchParams.get('q')?.trim() ?? '';
	const tag = url.searchParams.get('tag')?.trim() ?? '';
	if (tag)
		return {
			q,
			tag,
			hits: [] as SearchHit[],
			tagged: elementsByTag(world.id, tag),
			fallback: false
		};
	if (!q) return { q, tag, hits: [] as SearchHit[], tagged: [], fallback: false };
	try {
		return { q, tag, hits: searchWorld(world.id, q, world.slug), tagged: [], fallback: false };
	} catch (e) {
		console.warn('[search] FTS query failed, falling back to LIKE:', (e as Error).message);
		const hits: SearchHit[] = [
			...searchElements(world.id, q).map((e) => ({
				kind: 'element' as const,
				id: e.id,
				title: e.name,
				snippet: e.summary,
				rank: 0,
				href: `/w/${world.slug}/e/${e.slug}`,
				icon: e.typeIcon,
				subtitle: e.typeName
			})),
			...searchChapters(world.id, q).map((c) => ({
				kind: 'chapter' as const,
				id: c.id,
				title: c.title,
				snippet: c.synopsis,
				rank: 0,
				href: `/w/${world.slug}/write/${c.id}`,
				icon: '📖',
				subtitle: c.manuscriptTitle
			}))
		];
		return { q, tag, hits, tagged: [], fallback: true };
	}
};
