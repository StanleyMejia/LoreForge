import { Marked, type Token, type Tokens } from 'marked';
import { xml, zip } from './zip';
import type { ExportBook } from './epub';

/**
 * A minimal WordprocessingML document. Built from marked's token tree rather than from its HTML,
 * because Word wants runs and paragraph styles, not tags.
 *
 * ponytail: lists are paragraphs with a literal bullet or number, which avoids shipping a
 * numbering.xml part for an export nobody edits as an outline. Upgrade path: add numbering.xml
 * and real w:numPr references if lists need to renumber in Word.
 * Images and tables are dropped: image bytes live outside the manuscript, and no chapter has a
 * table today.
 */

const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

interface Run {
	text: string;
	bold?: boolean;
	italic?: boolean;
	code?: boolean;
}

/** Flatten inline tokens into runs, carrying emphasis down through nesting. */
function runs(tokens: Token[] | undefined, inherited: Omit<Run, 'text'> = {}): Run[] {
	const out: Run[] = [];
	for (const t of tokens ?? []) {
		if (t.type === 'strong')
			out.push(...runs((t as Tokens.Strong).tokens, { ...inherited, bold: true }));
		else if (t.type === 'em')
			out.push(...runs((t as Tokens.Em).tokens, { ...inherited, italic: true }));
		else if (t.type === 'codespan')
			out.push({ ...inherited, code: true, text: (t as Tokens.Codespan).text });
		else if (t.type === 'link') out.push(...runs((t as Tokens.Link).tokens, inherited));
		else if (t.type === 'del') out.push(...runs((t as Tokens.Del).tokens, inherited));
		else if (t.type === 'br') out.push({ ...inherited, text: '\n' });
		else if (t.type === 'image') continue;
		else if ('tokens' in t && Array.isArray(t.tokens) && t.type !== 'text')
			out.push(...runs(t.tokens as Token[], inherited));
		else if ('text' in t && typeof t.text === 'string') {
			// A `text` token may itself hold inline children (emphasis inside a paragraph).
			const nested = (t as Tokens.Text).tokens;
			if (nested?.length) out.push(...runs(nested, inherited));
			else out.push({ ...inherited, text: t.text });
		}
	}
	return out;
}

function runXml(r: Run): string {
	const props: string[] = [];
	if (r.bold) props.push('<w:b/>');
	if (r.italic) props.push('<w:i/>');
	if (r.code) props.push('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>');
	// A soft line break inside a paragraph is a run of its own in Word.
	if (r.text === '\n') return '<w:r><w:br/></w:r>';
	const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : '';
	return `<w:r>${rPr}<w:t xml:space="preserve">${xml(r.text)}</w:t></w:r>`;
}

function para(rs: Run[], style?: string): string {
	const pPr = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : '';
	return `<w:p>${pPr}${rs.map(runXml).join('')}</w:p>`;
}

function blocks(tokens: Token[], out: string[], prefix = ''): void {
	for (const t of tokens) {
		switch (t.type) {
			case 'heading': {
				const h = t as Tokens.Heading;
				out.push(para(runs(h.tokens), `Heading${Math.min(h.depth, 3)}`));
				break;
			}
			case 'paragraph':
				out.push(para(runs((t as Tokens.Paragraph).tokens)));
				break;
			case 'blockquote':
				for (const inner of (t as Tokens.Blockquote).tokens)
					out.push(para(runs('tokens' in inner ? (inner.tokens as Token[]) : []), 'Quote'));
				break;
			case 'list': {
				const list = t as Tokens.List;
				let n = typeof list.start === 'number' && list.start ? list.start : 1;
				for (const item of list.items) {
					const marker = list.ordered ? `${n++}. ` : '• ';
					// A tight item holds `text` tokens and a loose one holds paragraphs; either way its
					// own inline content becomes one marked paragraph. A nested list recurses, indented.
					const nested = item.tokens.filter((s) => s.type === 'list');
					const inline = item.tokens.filter((s) => s.type !== 'list');
					out.push(para([{ text: prefix + marker }, ...runs(inline)]));
					if (nested.length) blocks(nested, out, `${prefix}    `);
				}
				break;
			}
			case 'code':
				out.push(para([{ text: (t as Tokens.Code).text, code: true }]));
				break;
			case 'hr':
				out.push(para([{ text: '* * *' }], 'Quote'));
				break;
			case 'space':
				break;
			default:
				if ('tokens' in t && Array.isArray(t.tokens)) blocks(t.tokens as Token[], out, prefix);
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

/** One .docx of a manuscript: a title, then each chapter starting on a new page. */
export function buildDocx(book: ExportBook): Uint8Array<ArrayBuffer> {
	const md = new Marked({ gfm: true, breaks: true });
	const body: string[] = [para([{ text: book.title }], 'Title')];
	if (book.description) body.push(para([{ text: book.description, italic: true }]));
	for (const c of book.chapters) {
		// Heading1 carries pageBreakBefore, so each chapter opens a page without a manual break.
		body.push(para([{ text: c.title || 'Untitled chapter' }], 'Heading1'));
		blocks(md.lexer(c.body ?? ''), body);
	}

	return zip([
		{
			path: '[Content_Types].xml',
			data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
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
</Relationships>
`
		},
		{ path: 'word/styles.xml', data: STYLES },
		{
			path: 'word/document.xml',
			data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${NS}"><w:body>
${body.join('\n')}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body></w:document>
`
		}
	]);
}
