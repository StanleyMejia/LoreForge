import { renderMarkdown, type RenderContext } from '$lib/markdown';
import { xml, zip, type ZipEntry } from './zip';

export interface ExportChapter {
	title: string;
	body: string;
}
export interface ExportBook {
	title: string;
	description: string;
	/** Stable per manuscript, so re-exporting replaces rather than duplicates in a library. */
	id: string;
	chapters: ExportChapter[];
	modified: Date;
}

const CSS = `body { font-family: Georgia, 'Times New Roman', serif; line-height: 1.5; margin: 5%; }
h1, h2, h3 { font-family: inherit; line-height: 1.2; }
h1 { text-align: center; margin: 15% 0 10%; }
blockquote { margin-left: 1.5em; font-style: italic; }
hr { border: 0; text-align: center; margin: 2em 0; }
hr:after { content: "* * *"; letter-spacing: 0.5em; }
code { font-family: monospace; }
`;

/**
 * marked emits HTML5, which is almost XHTML. Only its void elements differ, and our own renderer
 * already self-closes images, so `br` and `hr` are the whole gap.
 */
function xhtml(html: string): string {
	return html.replace(/<(br|hr)\s*>/g, '<$1/>');
}

function page(title: string, inner: string): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${xml(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
${inner}
</body>
</html>
`;
}

/** An EPUB 3 of one manuscript: a title page, a nav document, and one file per chapter. */
export function buildEpub(book: ExportBook, ctx: RenderContext): Uint8Array<ArrayBuffer> {
	const plain: RenderContext = { ...ctx, plain: true };
	const files = book.chapters.map((c, i) => ({
		id: `ch${String(i + 1).padStart(3, '0')}`,
		title: c.title || `Chapter ${i + 1}`,
		html: xhtml(renderMarkdown(c.body, plain))
	}));

	const nav = `<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>
${files.map((f) => `<li><a href="${f.id}.xhtml">${xml(f.title)}</a></li>`).join('\n')}
</ol></nav>`;

	const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:${xml(book.id)}</dc:identifier>
    <dc:title>${xml(book.title)}</dc:title>
    <dc:language>en</dc:language>
${book.description ? `    <dc:description>${xml(book.description)}</dc:description>\n` : ''}    <meta property="dcterms:modified">${book.modified.toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
${files.map((f) => `    <item id="${f.id}" href="${f.id}.xhtml" media-type="application/xhtml+xml"/>`).join('\n')}
  </manifest>
  <spine>
    <itemref idref="title"/>
${files.map((f) => `    <itemref idref="${f.id}"/>`).join('\n')}
  </spine>
</package>
`;

	const entries: ZipEntry[] = [
		// Must be first and stored, per the EPUB container spec.
		{ path: 'mimetype', data: 'application/epub+zip', store: true },
		{
			path: 'META-INF/container.xml',
			data: `<?xml version="1.0" encoding="UTF-8"?>
<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
  <rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`
		},
		{ path: 'OEBPS/package.opf', data: opf },
		{ path: 'OEBPS/style.css', data: CSS },
		{ path: 'OEBPS/nav.xhtml', data: page('Contents', nav) },
		{
			path: 'OEBPS/title.xhtml',
			data: page(
				book.title,
				`<h1>${xml(book.title)}</h1>${book.description ? `\n<p>${xml(book.description)}</p>` : ''}`
			)
		},
		...files.map((f) => ({
			path: `OEBPS/${f.id}.xhtml`,
			data: page(f.title, `<h2>${xml(f.title)}</h2>\n${f.html}`)
		}))
	];
	return zip(entries);
}
