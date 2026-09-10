import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getWorldBySlug } from '$lib/server/repo/worlds';
import { createUpload } from '$lib/server/repo/uploads';
import { MAX_UPLOAD_BYTES, sniffImage } from '$lib/server/uploads';

/**
 * Upload an image (multipart field `file`). Editor role is enforced by hooks.server.ts.
 * Returns the URL to use anywhere an image URL is accepted.
 */
export const POST: RequestHandler = async ({ params, request, url, locals }) => {
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) error(403, 'Cross-origin request rejected');
	const world = getWorldBySlug(params.world);
	if (!world) error(404);

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		error(400, 'Expected multipart form data');
	}
	const file = form.get('file');
	if (!(file instanceof File)) error(400, 'No file');
	if (file.size > MAX_UPLOAD_BYTES)
		error(413, `File is larger than ${Math.round(MAX_UPLOAD_BYTES / 1048576)} MB`);
	const data = new Uint8Array(await file.arrayBuffer());
	const kind = sniffImage(data);
	if (!kind) error(415, 'Only PNG, JPEG, GIF and WebP images are accepted');

	const row = await createUpload({
		worldId: world.id,
		filename: file.name,
		mime: kind.mime,
		ext: kind.ext,
		data,
		createdBy: locals.user?.id ?? null
	});
	return json(
		{
			id: row.id,
			url: `/w/${world.slug}/files/${row.id}`,
			name: row.filename,
			size: row.size,
			mime: row.mime
		},
		{ status: 201 }
	);
};
