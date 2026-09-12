import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getManuscript, readManuscript } from '$lib/server/repo/manuscripts';
import { elementIndex } from '$lib/server/repo/elements';
import { makeResolver } from '$lib/markdown';
import { buildEpub, type ExportBook } from '$lib/server/epub';
import { buildDocx } from '$lib/server/docx';
import { slugify } from '$lib/slug';

const TYPES = {
	epub: 'application/epub+zip',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
} as const;

/** Download a manuscript as EPUB or DOCX. GET, so viewers of a shared world can export too. */
export const GET: RequestHandler = ({ params, url, locals }) => {
	const world = locals.world!;
	const manuscript = getManuscript(world.id, params.manuscript);
	if (!manuscript) error(404, 'Manuscript not found');

	const format = url.searchParams.get('format') === 'docx' ? 'docx' : 'epub';
	const chapters = readManuscript(manuscript.id);
	if (!chapters.length) error(400, 'This manuscript has no chapters yet.');

	const book: ExportBook = {
		title: manuscript.title,
		description: manuscript.description,
		id: manuscript.id,
		modified: manuscript.updatedAt,
		chapters: chapters.map((c) => ({ title: c.title, body: c.body }))
	};

	const file =
		format === 'epub'
			? buildEpub(book, {
					elementBase: `/w/${world.slug}/e/`,
					resolve: makeResolver(elementIndex(world.id))
				})
			: buildDocx(book);

	return new Response(file, {
		headers: {
			'content-type': TYPES[format],
			'content-length': String(file.length),
			'content-disposition': `attachment; filename="${slugify(manuscript.title)}.${format}"`,
			'cache-control': 'private, no-store'
		}
	});
};
