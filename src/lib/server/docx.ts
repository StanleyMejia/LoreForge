import { Marked, type Token, type Tokens } from 'marked';
import { xml, zip } from './zip';
import type { ExportBook } from './epub';

/**
 * A minimal WordprocessingML document. Built from marked's token tree rather than from its HTML,
 * because Word wants runs and paragraph styles, not tags.
 *
 * Lists use real Word numbering (numbering.xml), so they renumber and indent when edited. Tables
 * become Word tables. Images are embedded when `loadImage` returns their bytes — the export route
 * resolves this world's own uploads and nothing else, so no outside URL is ever fetched.
 *
 * ponytail: PNG, JPEG and GIF only. WebP, which Word versions before 2019 cannot open, falls back
 * to its alt text. Upgrade path: transcode WebP on upload.
 */

const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

/** Printable width inside the page margins: A4 (11906 twips) less two 1440 margins. */
const TEXT_TWIPS = 11906 - 2 * 1440;
const EMU_PER_TWIP = 635;
const EMU_PER_PX = 9525; // at 96 dpi

interface Run {
	text: string;
	bold?: boolean;
	italic?: boolean;
	code?: boolean;
	/** A prebuilt <w:drawing> for an inline image. */
	drawing?: string;
}

interface Ctx {
	image(href: string, alt: string): string | null;
	/** A numbering instance for a list; ordered lists get their own so each restarts. */
	list(ordered: boolean, start: number, level: number): number;
}

/** Type and pixel size from an image's header bytes, for the formats Word opens everywhere. */
export function pictureInfo(b: Uint8Array): { ext: string; width: number; height: number } | null {
	const be16 = (i: number) => (b[i] << 8) | b[i + 1];
	if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
		return { ext: 'png', width: be16(16) * 65536 + be16(18), height: be16(20) * 65536 + be16(22) };
	if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46)
		return { ext: 'gif', width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
	if (b[0] === 0xff && b[1] === 0xd8) {
		// Walk the JPEG segments to the first start-of-frame marker, which carries the size.
		for (let i = 2; i + 9 < b.length;) {
			if (b[i] !== 0xff) return null;
			const m = b[i + 1];
			if (m === 0xff) {
				i++; // fill byte
				continue;
			}
			if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
				return { ext: 'jpeg', width: be16(i + 7), height: be16(i + 5) };
			i += 2 + be16(i + 2);
		}
	}
	return null;
}

/** Flatten inline tokens into runs, carrying emphasis down through nesting. */
function runs(tokens: Token[] | undefined, ctx: Ctx, inherited: Omit<Run, 'text'> = {}): Run[] {
	const out: Run[] = [];
	for (const t of tokens ?? []) {
		if (t.type === 'strong')
			out.push(...runs((t as Tokens.Strong).tokens, ctx, { ...inherited, bold: true }));
		else if (t.type === 'em')
			out.push(...runs((t as Tokens.Em).tokens, ctx, { ...inherited, italic: true }));
		else if (t.type === 'codespan')
			out.push({ ...inherited, code: true, text: (t as Tokens.Codespan).text });
		else if (t.type === 'link') out.push(...runs((t as Tokens.Link).tokens, ctx, inherited));
		else if (t.type === 'del') out.push(...runs((t as Tokens.Del).tokens, ctx, inherited));
		else if (t.type === 'br') out.push({ ...inherited, text: '\n' });
		else if (t.type === 'image') {
			const img = t as Tokens.Image;
			const drawing = ctx.image(img.href, img.text);
			if (drawing) out.push({ text: '', drawing });
			else if (img.text) out.push({ ...inherited, italic: true, text: `[${img.text}]` });
		} else if ('tokens' in t && Array.isArray(t.tokens) && t.type !== 'text')
			out.push(...runs(t.tokens as Token[], ctx, inherited));
		else if ('text' in t && typeof t.text === 'string') {
			// A `text` token may itself hold inline children (emphasis inside a paragraph).
			const nested = (t as Tokens.Text).tokens;
			if (nested?.length) out.push(...runs(nested, ctx, inherited));
			else out.push({ ...inherited, text: t.text });
		}
	}
	return out;
}

function runXml(r: Run): string {
	if (r.drawing) return `<w:r>${r.drawing}</w:r>`;
	const props: string[] = [];
	if (r.bold) props.push('<w:b/>');
	if (r.italic) props.push('<w:i/>');
	if (r.code) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
	// A soft line break inside a paragraph is a run of its own in Word.
	if (r.text === '\n') return '<w:r><w:br/></w:r>';
	const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
	return `<w:r>${rPr}<w:t xml:space="preserve">${xml(r.text)}</w:t></w:r>`;
}

/** A paragraph. `pPr` is extra paragraph properties in schema order after the style. */
function para(rs: Run[], style?: string, pPr = ''): string {
	const props = (style ? `<w:pStyle w:val="${style}"/>` : '') + pPr;
	return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${rs.map(runXml).join('')}</w:p>`;
}

const BORDER = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
	.map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`)
	.join('');

function table(tb: Tokens.Table, ctx: Ctx): string {
	const col = Math.floor(TEXT_TWIPS / Math.max(1, tb.header.length));
	const cell = (c: Tokens.TableCell, i: number, head: boolean) => {
		const jc = tb.align[i] ? `<w:jc w:val="${tb.align[i]}"/>` : '';
		const content = para(runs(c.tokens, ctx, head ? { bold: true } : {}), undefined, jc);
		return `<w:tc><w:tcPr><w:tcW w:w="${col}" w:type="dxa"/></w:tcPr>${content}</w:tc>`;
	};
	const row = (cells: Tokens.TableCell[], head: boolean) =>
		`<w:tr>${head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.map((c, i) => cell(c, i, head)).join('')}</w:tr>`;
	return (
		`<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${BORDER}</w:tblBorders>` +
		`<w:tblCellMar><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr>` +
		`<w:tblGrid>${tb.header.map(() => `<w:gridCol w:w="${col}"/>`).join('')}</w:tblGrid>` +
		row(tb.header, true) +
		tb.rows.map((r) => row(r, false)).join('') +
		'</w:tbl>'
	);
}

function blocks(tokens: Token[], out: string[], ctx: Ctx, level = 0): void {
	for (const t of tokens) {
		switch (t.type) {
			case 'heading': {
				const h = t as Tokens.Heading;
				out.push(para(runs(h.tokens, ctx), `Heading${Math.min(h.depth, 3)}`));
				break;
			}
			case 'paragraph':
				out.push(para(runs((t as Tokens.Paragraph).tokens, ctx)));
				break;
			case 'blockquote':
				for (const inner of (t as Tokens.Blockquote).tokens)
					out.push(para(runs('tokens' in inner ? (inner.tokens as Token[]) : [], ctx), 'Quote'));
				break;
			case 'list': {
				const list = t as Tokens.List;
				const lvl = Math.min(level, 8);
				const start = typeof list.start === 'number' ? list.start : 1;
				const numPr = `<w:numPr><w:ilvl w:val="${lvl}"/><w:numId w:val="${ctx.list(list.ordered, start, lvl)}"/></w:numPr>`;
				for (const item of list.items) {
					// A tight item holds `text` tokens and a loose one holds paragraphs; either way its
					// own inline content becomes one numbered paragraph. A nested list goes a level down.
					const nested = item.tokens.filter((s) => s.type === 'list');
					const inline = item.tokens.filter((s) => s.type !== 'list');
					out.push(para(runs(inline, ctx), undefined, numPr));
					if (nested.length) blocks(nested, out, ctx, level + 1);
				}
				break;
			}
			case 'table':
				out.push(table(t as Tokens.Table, ctx));
				// Word fuses tables that touch, and wants breathing room after one anyway.
				out.push(para([]));
				break;
			case 'code':
				out.push(para([{ text: (t as Tokens.Code).text, code: true }]));
				break;
			case 'hr':
				out.push(para([{ text: '* * *' }], 'Quote'));
				break;
			case 'space':
				break;
			default:
				if ('tokens' in t && Array.isArray(t.tokens)) blocks(t.tokens as Token[], out, ctx, level);
				else if ('text' in t && typeof t.text === 'string' && t.text.trim())
					out.push(para([{ text: t.text }]));
		}
	}
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${NS}">
  <w:docDefaults><w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/>
  </w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr>
    <w:jc w:val="center"/><w:spacing w:before="2400" w:after="480"/></w:pPr>
    <w:rPr><w:sz w:val="56"/><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr>
    <w:pageBreakBefore/><w:spacing w:before="480" w:after="240"/></w:pPr>
    <w:rPr><w:sz w:val="36"/><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="360" w:after="180"/></w:pPr>
    <w:rPr><w:sz w:val="30"/><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/>
    <w:pPr><w:spacing w:before="280" w:after="140"/></w:pPr>
    <w:rPr><w:sz w:val="26"/><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/>
    <w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
</w:styles>
`;

/** One abstract list definition per kind, nine levels deep, indenting half an inch a level. */
function abstractNum(id: number, ordered: boolean): string {
	const bullets = ['•', '◦', '▪'];
	const formats = ['decimal', 'lowerLetter', 'lowerRoman'];
	const levels = Array.from({ length: 9 }, (_, i) => {
		const fmt = ordered ? formats[i % 3] : 'bullet';
		const text = ordered ? `%${i + 1}.` : bullets[i % 3];
		return `<w:lvl w:ilvl="${i}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${720 * (i + 1)}" w:hanging="360"/></w:pPr></w:lvl>`;
	});
	return `<w:abstractNum w:abstractNumId="${id}"><w:multiLevelType w:val="multilevel"/>${levels.join('')}</w:abstractNum>`;
}

/**
 * One .docx of a manuscript: a title, then each chapter starting on a new page. `loadImage` maps
 * an image's markdown href to its bytes, or null to leave the alt text in its place.
 */
export function buildDocx(
	book: ExportBook,
	loadImage: (href: string) => Uint8Array | null = () => null
): Uint8Array<ArrayBuffer> {
	const files: { path: string; data: string | Uint8Array }[] = [];
	const media: { path: string; rid: string }[] = [];
	const byHref = new Map<string, { rid: string; cx: number; cy: number } | null>();
	const nums: string[] = [];
	let drawings = 0;

	const ctx: Ctx = {
		image(href, alt) {
			if (!byHref.has(href)) {
				const bytes = loadImage(href);
				const info = bytes && pictureInfo(bytes);
				if (!bytes || !info || !info.width || !info.height) byHref.set(href, null);
				else {
					const rid = `rIdImg${media.length + 1}`;
					const path = `media/image${media.length + 1}.${info.ext}`;
					media.push({ path, rid });
					files.push({ path: `word/${path}`, data: bytes });
					// Natural size at 96 dpi, shrunk to the text width when wider.
					const scale = Math.min(1, (TEXT_TWIPS * EMU_PER_TWIP) / (info.width * EMU_PER_PX));
					byHref.set(href, {
						rid,
						cx: Math.round(info.width * EMU_PER_PX * scale),
						cy: Math.round(info.height * EMU_PER_PX * scale)
					});
				}
			}
			const img = byHref.get(href);
			if (!img) return null;
			const n = ++drawings;
			return (
				`<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${img.cx}" cy="${img.cy}"/>` +
				`<wp:docPr id="${n}" name="Picture ${n}" descr="${xml(alt)}"/>` +
				`<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
				`<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>` +
				`<pic:nvPicPr><pic:cNvPr id="${n}" name="Picture ${n}"/><pic:cNvPicPr/></pic:nvPicPr>` +
				`<pic:blipFill><a:blip r:embed="${img.rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
				`<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${img.cx}" cy="${img.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
				`</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
			);
		},
		list(ordered, start, level) {
			// Every bullet list shares numbering 1. Each ordered list gets its own, starting at its
			// own first number, so a second list does not carry on from the first.
			if (!ordered) return 1;
			nums.push(
				`<w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="${level}"><w:startOverride w:val="${start}"/></w:lvlOverride>`
			);
			return nums.length + 1;
		}
	};

	const md = new Marked({ gfm: true, breaks: true });
	const body: string[] = [para([{ text: book.title }], 'Title')];
	if (book.description) body.push(para([{ text: book.description, italic: true }]));
	for (const c of book.chapters) {
		// Heading1 carries pageBreakBefore, so each chapter opens a page without a manual break.
		body.push(para([{ text: c.title || 'Untitled chapter' }], 'Heading1'));
		blocks(md.lexer(c.body ?? ''), body, ctx);
	}

	const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${NS}">
${abstractNum(0, false)}
${abstractNum(1, true)}
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
${nums.map((n, i) => `<w:num w:numId="${i + 2}">${n}</w:num>`).join('\n')}
</w:numbering>
`;

	return zip([
		{
			path: '[Content_Types].xml',
			data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="gif" ContentType="image/gif"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>
`
		},
		{
			path: '_rels/.rels',
			data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_REL}">
  <Relationship Id="rId1" Type="${REL}/officeDocument" Target="word/document.xml"/>
</Relationships>
`
		},
		{
			path: 'word/_rels/document.xml.rels',
			data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${PKG_REL}">
  <Relationship Id="rId1" Type="${REL}/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="${REL}/numbering" Target="numbering.xml"/>
${media.map((m) => `  <Relationship Id="${m.rid}" Type="${REL}/image" Target="${m.path}"/>`).join('\n')}
</Relationships>
`
		},
		{ path: 'word/styles.xml', data: STYLES },
		{ path: 'word/numbering.xml', data: numbering },
		{
			path: 'word/document.xml',
			data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${NS}" xmlns:r="${REL}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>
${body.join('\n')}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body></w:document>
`
		},
		...files
	]);
}
