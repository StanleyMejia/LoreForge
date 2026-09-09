import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getWorldBySlug, listTypesWithCounts } from '$lib/server/repo/worlds';
import { elementIndex } from '$lib/server/repo/elements';
import { canEdit } from '$lib/server/repo/members';

export const load: LayoutServerLoad = ({ params, locals }) => {
	const world = getWorldBySlug(params.world);
	if (!world) error(404, 'World not found');
	const role = locals.world?.role ?? 'owner';
	return {
		world,
		role,
		/** True for viewers: templates hide editing affordances (the server enforces it regardless). */
		readonly: !canEdit(role),
		types: listTypesWithCounts(world.id),
		index: elementIndex(world.id)
	};
};
