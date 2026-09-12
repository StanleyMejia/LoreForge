import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUpload } from '$lib/server/repo/uploads';
import { fileExists, openFile } from '$lib/server/uploads';

/** Serve an uploaded image. World membership is enforced by hooks.server.ts. */
export const GET: RequestHandler = ({ params, request, locals }) => {
	const world = locals.world!;
	const row = getUpload(world.id, params.id);
	if (!row || !fileExists(row.storagePath)) error(404, 'File not found');
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
