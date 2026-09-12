import type { PageServerLoad } from './$types';
import { allTags } from '$lib/server/repo/elements';

export const load: PageServerLoad = async ({ parent }) => {
	const { world } = await parent();
	return { tags: allTags(world.id) };
};
