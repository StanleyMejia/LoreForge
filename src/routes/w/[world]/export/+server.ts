import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getWorldBySlug } from '$lib/server/repo/worlds';
import { exportWorld } from '$lib/server/repo/export';

export const GET: RequestHandler = ({ params }) => {
	const world = getWorldBySlug(params.world);
	if (!world) error(404);
	const data = exportWorld(world.id);
	const stamp = new Date().toISOString().slice(0, 10);
	return new Response(JSON.stringify(data, null, 2), {
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'content-disposition': `attachment; filename="${world.slug}-${stamp}.json"`
		}
	});
};
