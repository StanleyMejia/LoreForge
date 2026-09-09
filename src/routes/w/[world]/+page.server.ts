import type { PageServerLoad } from './$types';
import { allTags, recentElements } from '$lib/server/repo/elements';
import { listManuscripts } from '$lib/server/repo/manuscripts';
import { listEvents } from '$lib/server/repo/timeline';

export const load: PageServerLoad = ({ parent }) => {
	return parent().then(({ world }) => ({
		recent: recentElements(world.id, 8),
		manuscripts: listManuscripts(world.id),
		eventCount: listEvents(world.id).length,
		tags: allTags(world.id).slice(0, 30)
	}));
};
