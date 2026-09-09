import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getWorldBySlug, listTypesWithCounts } from '$lib/server/repo/worlds';
import { elementIndex } from '$lib/server/repo/elements';

export const load: LayoutServerLoad = ({ params }) => {
	const world = getWorldBySlug(params.world);
	if (!world) error(404, 'World not found');
	return {
		world,
		types: listTypesWithCounts(world.id),
		index: elementIndex(world.id)
	};
};
