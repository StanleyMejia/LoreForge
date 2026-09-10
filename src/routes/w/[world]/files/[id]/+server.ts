import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getWorldBySlug } from '$lib/server/repo/worlds';
import { getUpload } from '$lib/server/repo/uploads';
import { fileExists, openFile } from '$lib/server/uploads';

/** Serve an uploaded image. World membership is enforced by hooks.server.ts. */
export const GET: RequestHandler = ({ params, request }) => {
	const world = getWorldBySlug(params.world);
	const row = world && getUpload(world.id, params.id);
	if (!world || !row || !fileExists(row.storagePath)) error(404, 'File not found');
	const etag = `"${row.id}"`;
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304 });
	return new Response(openFile(row.storagePath), {
		headers: {
			'content-type': row.mime,
			'content-length': String(row.size),
			'cache-control': 'private, max-age=31536000, immutable',
			etag,
			'x-content-type-options': 'nosniff',
			'content-disposition': `inline; filename="${row.filename.replace(/[^\w.-]+/g, '_')}"`
		}
	});
};
