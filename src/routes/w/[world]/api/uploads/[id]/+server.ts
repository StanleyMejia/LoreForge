import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteUpload } from '$lib/server/repo/uploads';

export const DELETE: RequestHandler = async ({ params, request, url, locals }) => {
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Cross-origin request rejected');
	const world = locals.world!;
	if (!(await deleteUpload(world.id, params.id))) error(404);
	return json({ ok: true });
};
